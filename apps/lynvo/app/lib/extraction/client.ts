import { Result, Schema } from "effect"
import { ERROR_CODES } from "@dg02002/lynvo-plugin-server-protocol"
import { ApiClientError, client } from "~/lib/api/client"
import { ExtractionCommandError } from "./errors"
import { resolveMetadataIconUrls } from "./metadata-icon-urls"
import { runWithRetries } from "~/lib/retry"
import {
  extractedLinkSchema,
  metadataSchema,
} from "~/features/links/storage-schemas"
import type { MetaData } from "~/features/links/types"

const extractionResultSchema = Schema.Struct({
  links: Schema.Array(extractedLinkSchema),
  meta: Schema.optional(metadataSchema),
})

const unauthorizedErrorSchema = Schema.Struct({
  _tag: Schema.Literal("UnauthorizedError"),
  message: Schema.String,
})

const extractionErrorSchema = Schema.Struct({
  _tag: Schema.Literal("ExtractionError"),
  message: Schema.Literals(ERROR_CODES),
})

const usageLimitErrorSchema = Schema.Struct({
  _tag: Schema.Literal("UsageLimitError"),
  message: Schema.String,
  retryAfterSeconds: Schema.Number,
})

const EXTRACTION_REQUEST_TIMEOUT_MS = 20_000
const EXTRACTION_MAX_RETRIES = 2
const EXTRACTION_RETRY_BASE_DELAY_MS = 250
const EXTRACTION_RETRY_JITTER_MS = 250
const EXTRACTION_MAX_RETRY_AFTER_MS = EXTRACTION_REQUEST_TIMEOUT_MS

type RetryableExtractionFailure =
  | {
      kind: "transient"
      retryAfterMs?: number
    }
  | {
      kind: "rate-limited"
      retryAfterMs?: number
    }

const parseRetryAfterMs = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined
  }
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000
  }
  const retryAt = Date.parse(value)
  return Number.isNaN(retryAt) ? undefined : Math.max(0, retryAt - Date.now())
}

const getApiResponse = (
  cause: unknown
): { readonly status: number; readonly headers: Headers } | undefined =>
  cause instanceof ApiClientError
    ? { status: cause.status, headers: cause.headers }
    : undefined

type UsageLimitError = typeof usageLimitErrorSchema.Type

const decodeUsageLimitError = (cause: unknown): UsageLimitError | undefined => {
  const usageLimit = Schema.decodeUnknownResult(usageLimitErrorSchema)(cause)
  return Result.isSuccess(usageLimit) ? usageLimit.success : undefined
}

const getRetryAfterMs = (
  response: ReturnType<typeof getApiResponse>,
  usageLimit: UsageLimitError | undefined
): number | undefined => {
  const headerDelay = parseRetryAfterMs(
    response?.headers.get("retry-after") ?? undefined
  )
  if (headerDelay !== undefined) {
    return headerDelay
  }
  return usageLimit
    ? Math.max(0, usageLimit.retryAfterSeconds * 1000)
    : undefined
}

const getRetryableFailure = (
  cause: unknown
): RetryableExtractionFailure | undefined => {
  const response = getApiResponse(cause)
  const usageLimit = decodeUsageLimitError(cause)
  const retryAfterMs = getRetryAfterMs(response, usageLimit)
  if (response?.status === 429) {
    return { kind: "rate-limited", retryAfterMs }
  }
  if (response?.status === 503) {
    return { kind: "transient", retryAfterMs }
  }
  if (isAbortOrTimeoutError(cause)) {
    return { kind: "transient" }
  }
  if (cause instanceof TypeError) {
    return { kind: "transient" }
  }
  return usageLimit ? { kind: "rate-limited", retryAfterMs } : undefined
}

const retryJitterMs = (): number =>
  Math.floor(Math.random() * EXTRACTION_RETRY_JITTER_MS)

const retryDelayMs = (retryNumber: number): number =>
  EXTRACTION_RETRY_BASE_DELAY_MS * 2 ** (retryNumber - 1) + retryJitterMs()

const retryableDelayMs = (
  retryAfterMs: number | undefined,
  retryNumber: number
): number | undefined => {
  if (retryAfterMs === undefined) {
    return retryDelayMs(retryNumber)
  }
  if (
    retryAfterMs + EXTRACTION_RETRY_JITTER_MS >
    EXTRACTION_MAX_RETRY_AFTER_MS
  ) {
    return undefined
  }
  return retryAfterMs + retryJitterMs()
}

const isAbortOrTimeoutError = (cause: unknown): boolean => {
  return (
    (cause instanceof Error || cause instanceof DOMException) &&
    (cause.name === "AbortError" || cause.name === "TimeoutError")
  )
}

const toExtractionCommandError = (
  cause: unknown,
  retryableFailure?: RetryableExtractionFailure
): ExtractionCommandError | undefined => {
  if (retryableFailure?.kind === "rate-limited") {
    return new ExtractionCommandError({ failure: { kind: "rate-limited" } })
  }
  if (retryableFailure?.kind === "transient") {
    return new ExtractionCommandError({ failure: { kind: "transient" } })
  }

  const unauthorized = Schema.decodeUnknownResult(unauthorizedErrorSchema)(
    cause
  )
  if (Result.isSuccess(unauthorized)) {
    return new ExtractionCommandError({ failure: { kind: "session-expired" } })
  }

  const extraction = Schema.decodeUnknownResult(extractionErrorSchema)(cause)
  if (
    Result.isSuccess(extraction) &&
    extraction.success.message === "TEMPORARY_FAILURE"
  ) {
    return new ExtractionCommandError({
      failure: { kind: "plugin-server-down" },
    })
  }

  return undefined
}

const runWithExtractionResilience = async <Value>(
  execute: () => Promise<Value>
): Promise<Value> => {
  try {
    return await runWithRetries(execute, {
      maxRetries: EXTRACTION_MAX_RETRIES,
      getDelayMs: (cause, retryNumber) => {
        const retryableFailure = getRetryableFailure(cause)
        return retryableFailure
          ? retryableDelayMs(retryableFailure.retryAfterMs, retryNumber)
          : undefined
      },
    })
  } catch (cause) {
    const retryableFailure = getRetryableFailure(cause)
    throw toExtractionCommandError(cause, retryableFailure) ?? cause
  }
}

const createExtractionRequestHeaders = () => ({
  "x-request-id": crypto.randomUUID(),
})

const runWithExtractionTimeout = async <Value>(
  execute: (signal: AbortSignal) => Promise<Value>
): Promise<Value> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    EXTRACTION_REQUEST_TIMEOUT_MS
  )
  try {
    return await execute(controller.signal)
  } finally {
    clearTimeout(timeoutId)
  }
}

const resolveClientMetadataIconUrls = (metadata: MetaData) =>
  globalThis.window === undefined
    ? metadata
    : resolveMetadataIconUrls(metadata, window.location.href)

export const defaultExtractionClient: ExtractionTransport = {
  extract: async (query) => {
    const headers = createExtractionRequestHeaders()
    const result = Schema.decodeUnknownSync(extractionResultSchema)(
      await runWithExtractionResilience(() =>
        runWithExtractionTimeout((signal) =>
          client.extraction.extract({ query, headers }, { signal })
        )
      )
    )
    const links = [...result.links]
    return result.meta
      ? { links, meta: resolveClientMetadataIconUrls(result.meta) }
      : { links }
  },
  getMetadata: async (query) => {
    const headers = createExtractionRequestHeaders()
    const metadata = Schema.decodeUnknownSync(metadataSchema)(
      await runWithExtractionResilience(() =>
        runWithExtractionTimeout((signal) =>
          client.extraction.getMetadata({ query, headers }, { signal })
        )
      )
    )
    return resolveClientMetadataIconUrls(metadata)
  },
}

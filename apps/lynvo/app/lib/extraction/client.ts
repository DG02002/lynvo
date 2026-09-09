import { Cause, Effect, Result, Schema } from "effect"
import { HttpClientError } from "effect/unstable/http"
import { client } from "~/lib/effect/api/client"
import { SavedLinkCommandError } from "~/features/links/saved-link-command-failure"
import { resolveMetadataIconUrls } from "./metadata-icon-urls"
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
  message: Schema.String,
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

const getHttpResponse = (cause: unknown) =>
  HttpClientError.isHttpClientError(cause) ? cause.response : undefined

const getRequestReference = (cause: unknown): string | undefined =>
  getHttpResponse(cause)?.headers["x-request-id"]

const getRetryAfterMs = (
  cause: unknown,
  response = getHttpResponse(cause)
): number | undefined => {
  const headerDelay = parseRetryAfterMs(response?.headers["retry-after"])
  if (headerDelay !== undefined) {
    return headerDelay
  }
  const usageLimit = Schema.decodeUnknownResult(usageLimitErrorSchema)(cause)
  return Result.isSuccess(usageLimit)
    ? Math.max(0, usageLimit.success.retryAfterSeconds * 1000)
    : undefined
}

const getRetryableFailure = (
  cause: unknown
): RetryableExtractionFailure | undefined => {
  const response = getHttpResponse(cause)
  if (response?.status === 429) {
    return { kind: "rate-limited", retryAfterMs: getRetryAfterMs(cause) }
  }
  if (response?.status === 503) {
    return { kind: "transient", retryAfterMs: getRetryAfterMs(cause) }
  }
  if (Cause.isTimeoutError(cause)) {
    return { kind: "transient" }
  }
  if (
    HttpClientError.isHttpClientError(cause) &&
    cause.reason._tag === "TransportError"
  ) {
    return { kind: "transient" }
  }
  const usageLimit = Schema.decodeUnknownResult(usageLimitErrorSchema)(cause)
  return Result.isSuccess(usageLimit)
    ? {
        kind: "rate-limited",
        retryAfterMs: getRetryAfterMs(cause),
      }
    : undefined
}

const retryDelayMs = (retryNumber: number): number =>
  EXTRACTION_RETRY_BASE_DELAY_MS * 2 ** (retryNumber - 1) +
  Math.floor(Math.random() * EXTRACTION_RETRY_JITTER_MS)

const wait = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs))

const retryAfterSeconds = (delayMs: number | undefined): number | undefined =>
  delayMs === undefined ? undefined : Math.ceil(delayMs / 1000)

const toExtractionCommandError = (
  cause: unknown,
  retryableFailure?: RetryableExtractionFailure
): SavedLinkCommandError | undefined => {
  const reference = getRequestReference(cause)
  if (retryableFailure?.kind === "rate-limited") {
    return new SavedLinkCommandError({
      failure: {
        kind: "rate-limited",
        retryAfterSeconds: retryAfterSeconds(retryableFailure.retryAfterMs),
        reference,
      },
    })
  }
  if (retryableFailure?.kind === "transient") {
    return new SavedLinkCommandError({
      failure: { kind: "transient", reference },
    })
  }

  const unauthorized = Schema.decodeUnknownResult(unauthorizedErrorSchema)(
    cause
  )
  if (Result.isSuccess(unauthorized)) {
    return new SavedLinkCommandError({ failure: { kind: "session-expired" } })
  }

  const extraction = Schema.decodeUnknownResult(extractionErrorSchema)(cause)
  if (
    Result.isSuccess(extraction) &&
    ["TEMPORARY_FAILURE", "PROTOCOL_MISMATCH", "AUTH_INVALID"].includes(
      extraction.success.message
    )
  ) {
    return new SavedLinkCommandError({
      failure: { kind: "plugin-server-down", reference },
    })
  }

  return undefined
}

const runWithExtractionResilience = async <Value>(
  execute: () => Promise<Value>,
  retries = 0
): Promise<Value> => {
  try {
    return await execute()
  } catch (cause) {
    const retryableFailure = getRetryableFailure(cause)
    if (!retryableFailure || retries >= EXTRACTION_MAX_RETRIES) {
      throw toExtractionCommandError(cause, retryableFailure) ?? cause
    }
    await wait(retryableFailure.retryAfterMs ?? retryDelayMs(retries + 1))
    return await runWithExtractionResilience(execute, retries + 1)
  }
}

const resolveClientMetadataIconUrls = (metadata: MetaData) =>
  globalThis.window === undefined
    ? metadata
    : resolveMetadataIconUrls(metadata, window.location.href)

export const defaultExtractionClient: ExtractionTransport = {
  extract: async (query) => {
    const result = Schema.decodeUnknownSync(extractionResultSchema)(
      await runWithExtractionResilience(() =>
        Effect.runPromise(
          client.extraction
            .extract({ query })
            .pipe(Effect.timeout(EXTRACTION_REQUEST_TIMEOUT_MS))
        )
      )
    )
    const links = [...result.links]
    return result.meta
      ? { links, meta: resolveClientMetadataIconUrls(result.meta) }
      : { links }
  },
  getMetadata: async (query) => {
    const metadata = Schema.decodeUnknownSync(metadataSchema)(
      await Effect.runPromise(client.extraction.getMetadata({ query }))
    )
    return resolveClientMetadataIconUrls(metadata)
  },
}

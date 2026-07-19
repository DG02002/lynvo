import { Effect } from "effect"
import {
  isSupportedProtocolVersion,
  manifestSchema,
  parseLynvoManifestExtension,
  validateUsageContract,
  usageResponseSchema,
  type ExtractorManifest,
} from "@lynvo/extractor-protocol"
import { WorkerRegistrationError } from "../errors"
import type { RegisteredWorker } from "./extractor-types"

export interface WorkerRegistrationInput {
  readonly baseUrl: string
  readonly apiKey: string
  readonly existingWorkers: ReadonlyArray<RegisteredWorker>
  readonly requestId?: string
}

export interface PreparedWorkerRegistration {
  readonly baseUrl: string
  readonly apiKey: string
  readonly manifest: ExtractorManifest
  readonly manifestValue: string
}

export interface WorkerRefreshInput {
  readonly worker: RegisteredWorker
  readonly requestId?: string
}

export interface PreparedWorkerRefresh {
  readonly manifest: ExtractorManifest
  readonly manifestValue: string
}

export const normalizeWorkerBaseUrl = Effect.fn(
  "WorkerRegistration.normalizeWorkerBaseUrl"
)(function* (
  baseUrl: string
): Effect.fn.Return<string, WorkerRegistrationError> {
  let url: URL
  try {
    url = new URL(baseUrl.trim())
  } catch {
    return yield* new WorkerRegistrationError({
      message: "Worker base URL must be a valid URL.",
    })
  }

  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    return yield* new WorkerRegistrationError({
      message: "Worker base URL must use HTTPS.",
    })
  }

  url.pathname = url.pathname.replace(/\/+$/, "")
  url.search = ""
  url.hash = ""
  return url.toString().replace(/\/$/, "")
})

const ensureUniqueWorker = Effect.fn("WorkerRegistration.ensureUniqueWorker")(
  function* (
    existingWorkers: ReadonlyArray<RegisteredWorker>,
    baseUrl: string
  ): Effect.fn.Return<void, WorkerRegistrationError> {
    const duplicate = existingWorkers.some(
      (worker) => worker.baseUrl.replace(/\/$/, "") === baseUrl
    )
    if (duplicate) {
      return yield* new WorkerRegistrationError({
        message: "This extractor worker is already registered.",
      })
    }
  }
)

const fetchJson = Effect.fn("WorkerRegistration.fetchJson")(function* (
  url: string,
  requestId?: string
): Effect.fn.Return<unknown, WorkerRegistrationError> {
  const response = yield* Effect.tryPromise({
    try: () =>
      requestId
        ? fetch(url, { headers: { "x-request-id": requestId } })
        : fetch(url),
    catch: (error) =>
      new WorkerRegistrationError({
        message: `Worker request failed: ${error instanceof Error ? error.message : String(error)}`,
      }),
  })

  if (!response.ok) {
    return yield* new WorkerRegistrationError({
      message: `Worker request failed with HTTP ${response.status}.`,
    })
  }

  return yield* Effect.tryPromise({
    try: () => response.json(),
    catch: (error) =>
      new WorkerRegistrationError({
        message: `Worker returned malformed JSON: ${error instanceof Error ? error.message : String(error)}`,
      }),
  })
})

const fetchWorkerManifest = Effect.fn("WorkerRegistration.fetchWorkerManifest")(
  function* (
    baseUrl: string,
    requestId?: string
  ): Effect.fn.Return<ExtractorManifest, WorkerRegistrationError> {
    const manifestJson = yield* fetchJson(`${baseUrl}/manifest`, requestId)
    const parsedManifest = manifestSchema.safeParse(manifestJson)
    if (!parsedManifest.success) {
      return yield* new WorkerRegistrationError({
        message: "Worker manifest does not match protocol v1.",
        details: parsedManifest.error.message,
      })
    }

    if (
      typeof manifestJson !== "object" ||
      manifestJson === null ||
      !("usage" in manifestJson)
    ) {
      return yield* new WorkerRegistrationError({
        message: "Worker manifest must declare the mandatory /usage endpoint.",
      })
    }

    if (!isSupportedProtocolVersion(parsedManifest.data.protocolVersion)) {
      return yield* new WorkerRegistrationError({
        message: `Worker protocol version ${parsedManifest.data.protocolVersion} is not supported.`,
      })
    }

    try {
      parseLynvoManifestExtension(parsedManifest.data)
    } catch (error) {
      return yield* new WorkerRegistrationError({
        message: "Worker source plugin metadata is invalid.",
        details: error instanceof Error ? error.message : String(error),
      })
    }

    return parsedManifest.data
  }
)

const verifyWorkerApiKey = Effect.fn("WorkerRegistration.verifyWorkerApiKey")(
  function* (
    baseUrl: string,
    apiKey: string,
    requestId?: string
  ): Effect.fn.Return<void, WorkerRegistrationError> {
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(`${baseUrl}/verify`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            ...(requestId ? { "x-request-id": requestId } : {}),
          },
        }),
      catch: (error) =>
        new WorkerRegistrationError({
          message: `Worker verification request failed: ${error instanceof Error ? error.message : String(error)}`,
        }),
    })

    if (!response.ok) {
      return yield* new WorkerRegistrationError({
        message:
          response.status === 401
            ? "API key verification failed."
            : `Worker verification failed with HTTP ${response.status}.`,
      })
    }
  }
)

const verifyWorkerUsage = Effect.fn("WorkerRegistration.verifyWorkerUsage")(
  function* (
    baseUrl: string,
    apiKey: string,
    requestId?: string
  ): Effect.fn.Return<void, WorkerRegistrationError> {
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(`${baseUrl}/usage`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            ...(requestId ? { "x-request-id": requestId } : {}),
          },
        }),
      catch: (error) =>
        new WorkerRegistrationError({
          message: `Worker usage request failed: ${error instanceof Error ? error.message : String(error)}`,
        }),
    })
    if (!response.ok) {
      return yield* new WorkerRegistrationError({
        message: `Worker usage verification failed with HTTP ${response.status}.`,
      })
    }
    const value = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () =>
        new WorkerRegistrationError({
          message: "Worker returned malformed usage JSON.",
        }),
    })
    const parsed = usageResponseSchema.safeParse(value)
    const contract = validateUsageContract(value)
    if (!parsed.success || !contract.ok) {
      return yield* new WorkerRegistrationError({
        message: "Worker usage response does not match protocol v1.",
        details: contract.issues.map((issue) => issue.message).join(" "),
      })
    }
  }
)

export const prepareWorkerRegistration = Effect.fn(
  "WorkerRegistration.prepareWorkerRegistration"
)(function* (
  input: WorkerRegistrationInput
): Effect.fn.Return<PreparedWorkerRegistration, WorkerRegistrationError> {
  const baseUrl = yield* normalizeWorkerBaseUrl(input.baseUrl)
  yield* ensureUniqueWorker(input.existingWorkers, baseUrl)
  const manifest = yield* fetchWorkerManifest(baseUrl, input.requestId)
  yield* verifyWorkerApiKey(baseUrl, input.apiKey, input.requestId)
  yield* verifyWorkerUsage(baseUrl, input.apiKey, input.requestId)

  return {
    baseUrl,
    apiKey: input.apiKey,
    manifest,
    manifestValue: JSON.stringify(manifest),
  }
})

export const prepareWorkerRefresh = Effect.fn(
  "WorkerRegistration.prepareWorkerRefresh"
)(function* (
  input: WorkerRefreshInput
): Effect.fn.Return<PreparedWorkerRefresh, WorkerRegistrationError> {
  const baseUrl = yield* normalizeWorkerBaseUrl(input.worker.baseUrl)
  const manifest = yield* fetchWorkerManifest(baseUrl, input.requestId)
  yield* verifyWorkerApiKey(baseUrl, input.worker.apiKey, input.requestId)
  yield* verifyWorkerUsage(baseUrl, input.worker.apiKey, input.requestId)

  return {
    manifest,
    manifestValue: JSON.stringify(manifest),
  }
})

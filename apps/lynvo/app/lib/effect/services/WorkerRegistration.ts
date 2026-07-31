import { Effect } from "effect"
import type { PluginServerManifest } from "@lynvo/plugin-server-protocol"
import {
  ExtractorProtocolClient,
  ExtractorProtocolClientError,
  HttpExtractorTransport,
} from "../../extraction/extractor-protocol-client"
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
  readonly manifest: PluginServerManifest
  readonly manifestValue: string
}

export interface WorkerRefreshInput {
  readonly worker: RegisteredWorker
  readonly requestId?: string
}

export interface PreparedWorkerRefresh {
  readonly manifest: PluginServerManifest
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
    if (
      existingWorkers.some(
        (worker) => worker.baseUrl.replace(/\/$/, "") === baseUrl
      )
    ) {
      return yield* new WorkerRegistrationError({
        message: "This extractor worker is already registered.",
      })
    }
  }
)

const registrationError = (
  cause: unknown,
  operation: "manifest" | "verify" | "usage"
): WorkerRegistrationError => {
  if (cause instanceof ExtractorProtocolClientError) {
    if (operation === "verify" && cause.status === 401) {
      return new WorkerRegistrationError({
        message: "API key verification failed.",
      })
    }
    if (operation === "usage" && cause.status) {
      return new WorkerRegistrationError({
        message: `Worker usage verification failed with HTTP ${cause.status}.`,
      })
    }
    return new WorkerRegistrationError({
      message:
        operation === "manifest"
          ? "Worker manifest does not match protocol v1."
          : `Worker ${operation} response does not match protocol v1.`,
      details: cause.code,
    })
  }
  return new WorkerRegistrationError({
    message: `Worker ${operation} request failed.`,
  })
}

const prepareWorker = Effect.fn("WorkerRegistration.prepareWorker")(function* (
  baseUrl: string,
  apiKey: string,
  requestId?: string
): Effect.fn.Return<PreparedWorkerRefresh, WorkerRegistrationError> {
  const client = new ExtractorProtocolClient(
    new HttpExtractorTransport(baseUrl)
  )
  const manifest = yield* Effect.tryPromise({
    try: () => client.getManifest({ requestId }),
    catch: (cause) => registrationError(cause, "manifest"),
  })
  yield* Effect.tryPromise({
    try: () => client.verify({ apiKey, requestId }),
    catch: (cause) => registrationError(cause, "verify"),
  })
  yield* Effect.tryPromise({
    try: () => client.getUsage({ apiKey, requestId }),
    catch: (cause) => registrationError(cause, "usage"),
  })
  return { manifest, manifestValue: JSON.stringify(manifest) }
})

export const prepareWorkerRegistration = Effect.fn(
  "WorkerRegistration.prepareWorkerRegistration"
)(function* (
  input: WorkerRegistrationInput
): Effect.fn.Return<PreparedWorkerRegistration, WorkerRegistrationError> {
  const baseUrl = yield* normalizeWorkerBaseUrl(input.baseUrl)
  yield* ensureUniqueWorker(input.existingWorkers, baseUrl)
  const prepared = yield* prepareWorker(baseUrl, input.apiKey, input.requestId)
  return { baseUrl, apiKey: input.apiKey, ...prepared }
})

export const prepareWorkerRefresh = Effect.fn(
  "WorkerRegistration.prepareWorkerRefresh"
)(function* (
  input: WorkerRefreshInput
): Effect.fn.Return<PreparedWorkerRefresh, WorkerRegistrationError> {
  const baseUrl = yield* normalizeWorkerBaseUrl(input.worker.baseUrl)
  return yield* prepareWorker(baseUrl, input.worker.apiKey, input.requestId)
})

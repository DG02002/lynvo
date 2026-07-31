import { Effect } from "effect"
import type { PluginServerManifest } from "@lynvo/plugin-server-protocol"
import {
  PluginServerClient,
  PluginServerClientError,
  HttpPluginServerTransport,
} from "../../extraction/plugin-server-client"
import { PluginServerRegistrationError } from "../errors"
import type { RegisteredPluginServer } from "./extraction-types"

export interface PluginServerRegistrationInput {
  readonly baseUrl: string
  readonly apiKey: string
  readonly existingPluginServers: ReadonlyArray<RegisteredPluginServer>
  readonly requestId?: string
}

export interface PreparedPluginServerRegistration {
  readonly baseUrl: string
  readonly apiKey: string
  readonly manifest: PluginServerManifest
  readonly manifestValue: string
}

export interface PluginServerRefreshInput {
  readonly pluginServer: RegisteredPluginServer
  readonly requestId?: string
}

export interface PreparedPluginServerRefresh {
  readonly manifest: PluginServerManifest
  readonly manifestValue: string
}

export const normalizePluginServerBaseUrl = Effect.fn(
  "PluginServerRegistration.normalizePluginServerBaseUrl"
)(function* (
  baseUrl: string
): Effect.fn.Return<string, PluginServerRegistrationError> {
  let url: URL
  try {
    url = new URL(baseUrl.trim())
  } catch {
    return yield* new PluginServerRegistrationError({
      message: "Plugin Server base URL must be a valid URL.",
    })
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    return yield* new PluginServerRegistrationError({
      message: "Plugin Server base URL must use HTTPS.",
    })
  }
  url.pathname = url.pathname.replace(/\/+$/, "")
  url.search = ""
  url.hash = ""
  return url.toString().replace(/\/$/, "")
})

const ensureUniquePluginServer = Effect.fn(
  "PluginServerRegistration.ensureUniquePluginServer"
)(function* (
  existingPluginServers: ReadonlyArray<RegisteredPluginServer>,
  baseUrl: string
): Effect.fn.Return<void, PluginServerRegistrationError> {
  if (
    existingPluginServers.some(
      (pluginServer) => pluginServer.baseUrl.replace(/\/$/, "") === baseUrl
    )
  ) {
    return yield* new PluginServerRegistrationError({
      message: "This Plugin Server is already registered.",
    })
  }
})

const registrationError = (
  cause: unknown,
  operation: "manifest" | "verify" | "usage"
): PluginServerRegistrationError => {
  if (cause instanceof PluginServerClientError) {
    if (operation === "verify" && cause.status === 401) {
      return new PluginServerRegistrationError({
        message: "API key verification failed.",
      })
    }
    if (operation === "usage" && cause.status) {
      return new PluginServerRegistrationError({
        message: `Plugin Server usage verification failed with HTTP ${cause.status}.`,
      })
    }
    return new PluginServerRegistrationError({
      message:
        operation === "manifest"
          ? "Plugin Server Manifest does not match protocol v1."
          : `Plugin Server ${operation} response does not match protocol v1.`,
      details: cause.code,
    })
  }
  return new PluginServerRegistrationError({
    message: `Plugin Server ${operation} request failed.`,
  })
}

const preparePluginServer = Effect.fn(
  "PluginServerRegistration.preparePluginServer"
)(function* (
  baseUrl: string,
  apiKey: string,
  requestId?: string
): Effect.fn.Return<
  PreparedPluginServerRefresh,
  PluginServerRegistrationError
> {
  const client = new PluginServerClient(new HttpPluginServerTransport(baseUrl))
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

export const preparePluginServerRegistration = Effect.fn(
  "PluginServerRegistration.preparePluginServerRegistration"
)(function* (
  input: PluginServerRegistrationInput
): Effect.fn.Return<
  PreparedPluginServerRegistration,
  PluginServerRegistrationError
> {
  const baseUrl = yield* normalizePluginServerBaseUrl(input.baseUrl)
  yield* ensureUniquePluginServer(input.existingPluginServers, baseUrl)
  const prepared = yield* preparePluginServer(
    baseUrl,
    input.apiKey,
    input.requestId
  )
  return { baseUrl, apiKey: input.apiKey, ...prepared }
})

export const preparePluginServerRefresh = Effect.fn(
  "PluginServerRegistration.preparePluginServerRefresh"
)(function* (
  input: PluginServerRefreshInput
): Effect.fn.Return<
  PreparedPluginServerRefresh,
  PluginServerRegistrationError
> {
  const baseUrl = yield* normalizePluginServerBaseUrl(
    input.pluginServer.baseUrl
  )
  return yield* preparePluginServer(
    baseUrl,
    input.pluginServer.apiKey,
    input.requestId
  )
})

import { Effect } from "effect"

import { listReadyPluginServersForService } from "../../../../workers/d1/plugin-servers"
import { readSealedProxyProviderToken } from "../../../../workers/d1/proxy-providers"
import { BackendError, type CredentialVaultError } from "../errors"
import {
  ACCOUNT_DATA_UNAVAILABLE_MESSAGE,
  requireDatabaseEffect,
} from "../require-database"
import {
  decryptCustomPluginServers,
  decryptProxyProviderToken,
} from "./custom-plugin-server-credentials"
import type { RegisteredPluginServer } from "./extraction-types"

export interface RegisteredExtractionContext {
  readonly pluginServers: ReadonlyArray<RegisteredPluginServer>
  /** Decrypted account-level proxy key; sent to proxy-enabled servers that declare support. */
  readonly proxyToken?: string
}

export const loadRegisteredPluginServers = Effect.fn(
  "AuthenticatedExtractionContext.loadRegisteredPluginServers"
)(function* (
  environment: Env,
  userId: string
): Effect.fn.Return<
  RegisteredExtractionContext,
  BackendError | CredentialVaultError
> {
  const database = yield* requireDatabaseEffect(
    environment,
    ACCOUNT_DATA_UNAVAILABLE_MESSAGE
  )
  const [storedPluginServers, sealedProxyToken] = yield* Effect.all([
    Effect.tryPromise({
      try: () => listReadyPluginServersForService(database, userId),
      catch: (cause) =>
        new BackendError({
          message: "Plugin servers are temporarily unavailable",
          cause,
        }),
    }),
    Effect.tryPromise({
      try: () => readSealedProxyProviderToken(database, userId),
      catch: (cause) =>
        new BackendError({
          message: "Proxy settings are temporarily unavailable",
          cause,
        }),
    }),
  ])
  const pluginServers = yield* decryptCustomPluginServers(
    environment,
    userId,
    storedPluginServers
  )
  // Proxy credentials live at the account level, so every extraction context
  // decrypts the single provider key once alongside the server API keys.
  const proxyToken = sealedProxyToken
    ? yield* decryptProxyProviderToken({
        environment,
        userId,
        provider: "scrape-do",
        sealed: sealedProxyToken,
      })
    : undefined
  return proxyToken === undefined
    ? { pluginServers }
    : { pluginServers, proxyToken }
})

import { Effect } from "effect"
import { BackendError, type CredentialVaultError } from "../errors"
import {
  ACCOUNT_DATA_UNAVAILABLE_MESSAGE,
  requireDatabaseEffect,
} from "../require-database"
import { listReadyPluginServersForService } from "../../../../workers/d1/plugin-servers"
import { decryptCustomPluginServers } from "./custom-plugin-server-credentials"
import type { RegisteredPluginServer } from "./extraction-types"

export interface RegisteredExtractionContext {
  readonly pluginServers: ReadonlyArray<RegisteredPluginServer>
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
  const storedPluginServers = yield* Effect.tryPromise({
    try: () => listReadyPluginServersForService(database, userId),
    catch: (cause) =>
      new BackendError({
        message: "Plugin servers are temporarily unavailable",
        cause,
      }),
  })
  const pluginServers = yield* decryptCustomPluginServers(
    environment,
    userId,
    storedPluginServers
  )
  return { pluginServers }
})

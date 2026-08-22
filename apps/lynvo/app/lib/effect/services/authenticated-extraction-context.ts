import { Effect } from "effect"
import { BackendError, type CredentialVaultError } from "../errors"
import { getD1Database } from "../../../../workers/d1/db"
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
  const database = getD1Database(environment)
  if (!database) {
    return yield* new BackendError({
      message: "Account data is temporarily unavailable",
    })
  }
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

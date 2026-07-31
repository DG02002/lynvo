import { Effect } from "effect"
import { api } from "../../../../convex/_generated/api"
import { CREDENTIAL_READ_TOKEN_TTL_MS } from "../../../../convex/constants"
import { signCredentialReadToken } from "../../../lib/auth-gateway"
import type { ConvexError, CredentialVaultError } from "../errors"
import type { ConvexServiceShape } from "./ConvexService"
import { decryptCustomPluginServers } from "./custom-plugin-server-credentials"
import type { RegisteredPluginServer } from "./extraction-types"

export interface AuthenticatedExtractionContext {
  readonly serviceToken: string
  readonly pluginServers: ReadonlyArray<RegisteredPluginServer>
}

export const loadAuthenticatedExtractionContext = Effect.fn(
  "AuthenticatedExtractionContext.loadAuthenticatedExtractionContext"
)(function* (
  convex: ConvexServiceShape,
  environment: Env,
  userId: string,
  accessToken: string
): Effect.fn.Return<
  AuthenticatedExtractionContext,
  ConvexError | CredentialVaultError
> {
  const serviceToken = yield* Effect.promise(() =>
    signCredentialReadToken(
      environment.AUTH_GATEWAY_SECRET,
      Date.now() + CREDENTIAL_READ_TOKEN_TTL_MS
    )
  )
  const storedPluginServers = yield* convex.query(
    api.userPluginServers.listForService,
    { serviceToken },
    { accessToken }
  )
  const pluginServers = yield* decryptCustomPluginServers(
    environment,
    userId,
    storedPluginServers
  )
  return { serviceToken, pluginServers }
})

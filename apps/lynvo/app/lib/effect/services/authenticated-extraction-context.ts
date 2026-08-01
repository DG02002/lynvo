import { Effect } from "effect"
import { api } from "../../../../convex/_generated/api"
import { CREDENTIAL_READ_TOKEN_TTL_MS } from "../../../../convex/constants"
import { signCredentialReadToken } from "../../../lib/auth-gateway"
import type {
  ConvexError,
  CredentialVaultError,
  ExtractionError,
  ValidationError,
} from "../errors"
import type { ConvexServiceShape } from "./ConvexService"
import { decryptCustomPluginServers } from "./custom-plugin-server-credentials"
import {
  selectExtractionRoute,
  type ExtractionRouteSelection,
} from "./extraction-route-selection"
import type {
  RegisteredPluginServer,
  SelectExtractionRouteOptions,
} from "./extraction-types"

export interface AuthenticatedExtractionContext {
  readonly serviceToken: string
  readonly pluginServers: ReadonlyArray<RegisteredPluginServer>
}

export interface AuthenticatedExtractionRoute {
  readonly serviceToken: string
  readonly pluginServers: ReadonlyArray<RegisteredPluginServer>
  readonly route: ExtractionRouteSelection
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

export const loadAuthenticatedExtractionRoute = Effect.fn(
  "AuthenticatedExtractionContext.loadAuthenticatedExtractionRoute"
)(function* (
  convex: ConvexServiceShape,
  environment: Env,
  userId: string,
  accessToken: string,
  routeOptions: SelectExtractionRouteOptions
): Effect.fn.Return<
  AuthenticatedExtractionRoute,
  ConvexError | CredentialVaultError | ExtractionError | ValidationError
> {
  const context = yield* loadAuthenticatedExtractionContext(
    convex,
    environment,
    userId,
    accessToken
  )
  const route = yield* selectExtractionRoute(
    convex,
    environment,
    context.pluginServers,
    routeOptions
  )
  return { ...context, route }
})

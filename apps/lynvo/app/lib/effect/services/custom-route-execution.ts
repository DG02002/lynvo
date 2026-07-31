import { Effect } from "effect"
import { ExtractionError } from "../errors"
import type { ConvexServiceShape } from "./ConvexService"
import { extractFromCustomPluginServer } from "./custom-plugin-server-adapter"
import type { CustomRouteSelection } from "./custom-route-selection"
import type { ExtractionResult } from "./extraction-types"
import { resolvePluginCredential } from "./plugin-credential-resolution"
import type { PluginCredentialVaultShape } from "./plugin-credential-vault"

export interface ExecuteCustomRouteOptions {
  readonly targetUrl: string
  readonly userId: string
  readonly accessToken: string
  readonly serviceToken: string
  readonly requestId: string
  readonly kind: "source" | "node"
  readonly inlineBasicAuth?: {
    readonly username: string
    readonly password: string
  }
}

export const executeCustomRoute = Effect.fn(
  "CustomRouteExecution.executeCustomRoute"
)(function* (
  convex: ConvexServiceShape,
  credentialVault: PluginCredentialVaultShape,
  route: CustomRouteSelection,
  options: ExecuteCustomRouteOptions
): Effect.fn.Return<ExtractionResult, ExtractionError> {
  const credentials = route.plugin
    ? yield* resolvePluginCredential(convex, credentialVault, {
        targetUrl: options.targetUrl,
        userId: options.userId,
        accessToken: options.accessToken,
        serviceToken: options.serviceToken,
        pluginServerId: route.pluginServer._id,
        plugin: route.plugin,
        inlineBasicAuth: options.inlineBasicAuth,
      })
    : {}
  return yield* extractFromCustomPluginServer(
    route.pluginServer,
    options.targetUrl,
    options.kind,
    { pluginId: route.plugin?.id, ...credentials },
    options.requestId
  )
})

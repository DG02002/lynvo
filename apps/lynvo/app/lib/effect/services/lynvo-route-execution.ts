import { Effect } from "effect"
import { api } from "../../../../convex/_generated/api"
import { LYNVO_PLUGIN_SERVER_ID } from "../../constants"
import { ExtractionError } from "../errors"
import type { ConvexServiceShape } from "./ConvexService"
import type { ExtractionResult } from "./extraction-types"
import { extractFromLynvoPluginServer } from "./lynvo-plugin-server-adapter"
import type { LynvoRouteSelection } from "./lynvo-route-selection"
import { resolvePluginCredential } from "./plugin-credential-resolution"
import type { PluginCredentialVaultShape } from "./plugin-credential-vault"

export interface ExecuteLynvoRouteOptions {
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

const getMeteredPluginId = (pluginId: string) => {
  if (
    pluginId === "bhadoo-google-drive-index" ||
    pluginId === "google-drive-public-files" ||
    pluginId === "onedrive-index" ||
    pluginId === "direct"
  ) {
    return pluginId
  }
  return undefined
}

export const executeLynvoRoute = Effect.fn(
  "LynvoRouteExecution.executeLynvoRoute"
)(function* (
  convex: ConvexServiceShape,
  credentialVault: PluginCredentialVaultShape,
  environment: Env,
  route: LynvoRouteSelection,
  options: ExecuteLynvoRouteOptions
): Effect.fn.Return<ExtractionResult, ExtractionError> {
  const credentials = yield* resolvePluginCredential(convex, credentialVault, {
    targetUrl: options.targetUrl,
    userId: options.userId,
    accessToken: options.accessToken,
    serviceToken: options.serviceToken,
    pluginServerId: LYNVO_PLUGIN_SERVER_ID,
    plugin: route.plugin,
    inlineBasicAuth: options.inlineBasicAuth,
  })
  const meteredPluginId = getMeteredPluginId(route.plugin.id)
  if (meteredPluginId) {
    yield* convex
      .mutation(
        api.usage.consumeLynvoPlugin,
        { pluginId: meteredPluginId },
        { accessToken: options.accessToken }
      )
      .pipe(
        Effect.mapError(
          (error) =>
            new ExtractionError({
              message: error.message,
              url: options.targetUrl,
            })
        )
      )
  }
  return yield* extractFromLynvoPluginServer(
    environment,
    options.targetUrl,
    options.kind,
    { pluginId: route.plugin.id, ...credentials },
    options.requestId
  )
})

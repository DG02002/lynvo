import type {
  HttpBasicAuth,
  PluginMetadata,
  PluginServerManifest,
} from "@lynvo/plugin-server-protocol"
import { Effect } from "effect"
import { api } from "../../../../convex/_generated/api"
import { LYNVO_PLUGIN_SERVER_ID } from "../../constants"
import { ExtractionError, ValidationError } from "../errors"
import type { ConvexServiceShape } from "./ConvexService"
import {
  discoverLynvoPlugin,
  findLynvoPlugin,
  getLynvoPluginServerManifest,
} from "./lynvo-plugin-server-adapter"

export interface LynvoRouteSelection {
  readonly manifest: PluginServerManifest
  readonly plugin: PluginMetadata
}

export interface SelectLynvoRouteOptions {
  readonly targetUrl: string
  readonly accessToken: string
  readonly requestId: string
  readonly pluginId?: string
  readonly kind: "source" | "node"
  readonly inlineBasicAuth?: HttpBasicAuth
}

export const selectLynvoRoute = Effect.fn(
  "LynvoRouteSelection.selectLynvoRoute"
)(function* (
  convex: ConvexServiceShape,
  environment: Env,
  options: SelectLynvoRouteOptions
): Effect.fn.Return<
  LynvoRouteSelection | undefined,
  ExtractionError | ValidationError
> {
  const manifest = yield* getLynvoPluginServerManifest(
    environment,
    options.requestId
  )
  const configuredDomain = yield* convex
    .query(
      api.pluginDomains.getByDomain,
      {
        domain: new URL(options.targetUrl).hostname,
        pluginServerId: LYNVO_PLUGIN_SERVER_ID,
      },
      { accessToken: options.accessToken }
    )
    .pipe(
      Effect.mapError(
        (error) =>
          new ValidationError({ message: error.message, details: error })
      )
    )
  let plugin = findLynvoPlugin(
    manifest,
    options.targetUrl,
    options.pluginId ?? configuredDomain?.pluginId
  )
  if (!plugin && manifest.features.discovery && options.kind === "source") {
    const discovery = yield* discoverLynvoPlugin(
      environment,
      options.targetUrl,
      options.inlineBasicAuth,
      options.requestId
    )
    if (discovery.matched) {
      plugin = findLynvoPlugin(manifest, options.targetUrl, discovery.pluginId)
    }
  }
  return plugin ? { manifest, plugin } : undefined
})

import type {
  HttpBasicAuth,
  PluginMetadata,
  PluginServerManifest,
} from "@dg02002/lynvo-plugin-server-protocol"
import { Effect } from "effect"
import { api } from "../../../../convex/_generated/api"
import { LYNVO_PLUGIN_SERVER_ID } from "../../constants"
import { ExtractionError, ValidationError } from "../errors"
import type { ConvexServiceShape } from "./ConvexService"
import type { ExtractionResult, MetadataResult } from "./extraction-types"
import {
  discoverLynvoPlugin,
  extractFromLynvoPluginServer,
  findLynvoPlugin,
  getLynvoPluginServerManifest,
  getLynvoPluginServerMetadata,
} from "./lynvo-plugin-server-adapter"
import { resolvePluginCredential } from "./plugin-credential-resolution"
import type { PluginCredentialVaultShape } from "./plugin-credential-vault"

export interface LynvoExtractionAdapterOptions {
  readonly targetUrl: string
  readonly accessToken: string
  readonly requestId: string
  readonly pluginId?: string
  readonly kind: "source" | "node"
  readonly inlineBasicAuth?: HttpBasicAuth
}

export interface AuthenticatedLynvoExtractionAdapterOptions extends LynvoExtractionAdapterOptions {
  readonly userId: string
  readonly serviceToken: string
}

export interface LynvoPluginRoute {
  readonly manifest: PluginServerManifest
  readonly plugin: PluginMetadata
}

const selectLynvoPlugin = Effect.fn("LynvoExtractionAdapter.selectLynvoPlugin")(
  function* (
    convex: ConvexServiceShape,
    environment: Env,
    options: LynvoExtractionAdapterOptions
  ): Effect.fn.Return<
    LynvoPluginRoute | undefined,
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
        plugin = findLynvoPlugin(
          manifest,
          options.targetUrl,
          discovery.pluginId
        )
      }
    }
    return plugin ? { manifest, plugin } : undefined
  }
)

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

export const extractWithLynvoPluginServer = Effect.fn(
  "LynvoExtractionAdapter.extract"
)(function* (
  convex: ConvexServiceShape,
  credentialVault: PluginCredentialVaultShape,
  environment: Env,
  options: AuthenticatedLynvoExtractionAdapterOptions
): Effect.fn.Return<
  ExtractionResult | undefined,
  ExtractionError | ValidationError
> {
  const route = yield* selectLynvoPlugin(convex, environment, options)
  if (!route) {
    return undefined
  }
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

export const getLynvoRouteMetadata = Effect.fn(
  "LynvoExtractionAdapter.getMetadata"
)(function* (
  convex: ConvexServiceShape,
  environment: Env,
  options: LynvoExtractionAdapterOptions
): Effect.fn.Return<
  MetadataResult | undefined,
  ExtractionError | ValidationError
> {
  const route = yield* selectLynvoPlugin(convex, environment, options)
  return route
    ? getLynvoPluginServerMetadata(
        route.manifest,
        options.targetUrl,
        route.plugin.id
      )
    : undefined
})

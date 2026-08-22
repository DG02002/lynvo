import type { HttpBasicAuth } from "@dg02002/lynvo-plugin-server-protocol"
import { Effect } from "effect"
import { ExtractionError, ValidationError } from "../errors"
import {
  discoverCustomPlugin,
  extractFromCustomPluginServer,
  getCustomPlugin,
  getCustomPluginServerMetadata,
  selectCustomPluginServer,
} from "./custom-plugin-server-adapter"
import type {
  ExtractionResult,
  MetadataResult,
  RegisteredPluginServer,
} from "./extraction-types"
import { resolvePluginCredential } from "./plugin-credential-resolution"
import type { PluginCredentialVaultContract } from "./plugin-credential-vault"

export interface CustomExtractionAdapterOptions {
  readonly environment: Env
  readonly targetUrl: string
  readonly userId: string
  readonly requestId: string
  readonly pluginServerId?: string
  readonly pluginId?: string
  readonly kind: "source" | "node"
  readonly inlineBasicAuth?: HttpBasicAuth
}

const selectCustomPlugin = Effect.fn(
  "CustomExtractionAdapter.selectCustomPlugin"
)(function* (
  pluginServers: ReadonlyArray<RegisteredPluginServer>,
  options: CustomExtractionAdapterOptions
) {
  const pluginServer = yield* selectCustomPluginServer(
    pluginServers,
    options.targetUrl,
    options.pluginServerId
  )
  if (!pluginServer) {
    return undefined
  }
  let plugin = yield* getCustomPlugin(
    pluginServer,
    options.targetUrl,
    options.pluginId
  )
  if (!plugin && !options.pluginId && options.kind === "source") {
    const discovery = yield* discoverCustomPlugin(
      pluginServer,
      options.targetUrl,
      options.inlineBasicAuth,
      options.requestId
    )
    if (discovery?.matched) {
      plugin = yield* getCustomPlugin(
        pluginServer,
        options.targetUrl,
        discovery.pluginId
      )
    }
  }
  if (options.pluginId && !plugin) {
    return yield* new ValidationError({
      message: "The saved Plugin is unavailable.",
    })
  }
  return { pluginServer, plugin }
})

export const extractWithCustomPluginServer = Effect.fn(
  "CustomExtractionAdapter.extract"
)(function* (
  credentialVault: PluginCredentialVaultContract,
  pluginServers: ReadonlyArray<RegisteredPluginServer>,
  options: CustomExtractionAdapterOptions
): Effect.fn.Return<
  ExtractionResult | undefined,
  ExtractionError | ValidationError
> {
  const route = yield* selectCustomPlugin(pluginServers, options)
  if (!route) {
    return undefined
  }
  const credentials = route.plugin
    ? yield* resolvePluginCredential(credentialVault, {
        environment: options.environment,
        targetUrl: options.targetUrl,
        userId: options.userId,
        pluginServerId: route.pluginServer.id,
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

export const getCustomRouteMetadata = Effect.fn(
  "CustomExtractionAdapter.getMetadata"
)(function* (
  pluginServers: ReadonlyArray<RegisteredPluginServer>,
  options: CustomExtractionAdapterOptions
): Effect.fn.Return<
  MetadataResult | undefined,
  ExtractionError | ValidationError
> {
  const route = yield* selectCustomPlugin(pluginServers, options)
  if (!route) {
    return undefined
  }
  return yield* getCustomPluginServerMetadata(
    route.pluginServer,
    options.targetUrl,
    route.plugin?.id
  )
})

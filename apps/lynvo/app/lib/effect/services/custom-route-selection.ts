import type {
  HttpBasicAuth,
  PluginMetadata,
} from "@lynvo/plugin-server-protocol"
import { Effect } from "effect"
import { ExtractionError } from "../errors"
import {
  discoverCustomPlugin,
  getCustomPlugin,
  selectCustomPluginServer,
} from "./custom-plugin-server-adapter"
import type { RegisteredPluginServer } from "./extraction-types"

export interface CustomRouteSelection {
  readonly pluginServer: RegisteredPluginServer
  readonly plugin?: PluginMetadata
}

export interface SelectCustomRouteOptions {
  readonly targetUrl: string
  readonly requestId: string
  readonly pluginServerId?: string
  readonly pluginId?: string
  readonly kind: "source" | "node"
  readonly inlineBasicAuth?: HttpBasicAuth
}

export const selectCustomRoute = Effect.fn(
  "CustomRouteSelection.selectCustomRoute"
)(function* (
  pluginServers: ReadonlyArray<RegisteredPluginServer>,
  options: SelectCustomRouteOptions
): Effect.fn.Return<CustomRouteSelection | undefined, ExtractionError> {
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
  return { pluginServer, plugin }
})

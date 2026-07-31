import type { HttpBasicAuth } from "@lynvo/plugin-server-protocol"
import { Effect } from "effect"
import { LYNVO_PLUGIN_SERVER_ID } from "../../constants"
import { ExtractionError, ValidationError } from "../errors"
import type { ConvexServiceShape } from "./ConvexService"
import {
  selectCustomRoute,
  type CustomRouteSelection,
} from "./custom-route-selection"
import type { RegisteredPluginServer } from "./extraction-types"
import {
  selectLynvoRoute,
  type LynvoRouteSelection,
} from "./lynvo-route-selection"

export type ExtractionRouteSelection =
  | { readonly kind: "custom"; readonly route: CustomRouteSelection }
  | { readonly kind: "lynvo"; readonly route: LynvoRouteSelection }
  | { readonly kind: "direct" }

export interface SelectExtractionRouteOptions {
  readonly targetUrl: string
  readonly accessToken: string
  readonly requestId: string
  readonly pluginServerId?: string
  readonly pluginId?: string
  readonly extractionKind: "source" | "node"
  readonly inlineBasicAuth?: HttpBasicAuth
}

export const selectExtractionRoute = Effect.fn(
  "ExtractionRouteSelection.selectExtractionRoute"
)(function* (
  convex: ConvexServiceShape,
  environment: Env,
  pluginServers: ReadonlyArray<RegisteredPluginServer>,
  options: SelectExtractionRouteOptions
): Effect.fn.Return<
  ExtractionRouteSelection,
  ExtractionError | ValidationError
> {
  const customRoute = yield* selectCustomRoute(pluginServers, {
    targetUrl: options.targetUrl,
    requestId: options.requestId,
    pluginServerId: options.pluginServerId,
    pluginId: options.pluginId,
    kind: options.extractionKind,
    inlineBasicAuth: options.inlineBasicAuth,
  })
  if (customRoute) {
    if (options.pluginId && !customRoute.plugin) {
      return yield* new ValidationError({
        message: "The saved Plugin is unavailable.",
      })
    }
    return { kind: "custom", route: customRoute }
  }
  if (
    options.pluginServerId &&
    options.pluginServerId !== LYNVO_PLUGIN_SERVER_ID
  ) {
    return yield* new ValidationError({
      message: "The saved Plugin Server is unavailable.",
    })
  }

  const lynvoRoute = yield* selectLynvoRoute(convex, environment, {
    targetUrl: options.targetUrl,
    accessToken: options.accessToken,
    requestId: options.requestId,
    pluginId: options.pluginId,
    kind: options.extractionKind,
    inlineBasicAuth: options.inlineBasicAuth,
  })
  if (lynvoRoute) {
    return { kind: "lynvo", route: lynvoRoute }
  }
  if (options.pluginServerId === LYNVO_PLUGIN_SERVER_ID) {
    return yield* new ValidationError({
      message: "The saved Plugin Server is unavailable.",
    })
  }
  return { kind: "direct" }
})

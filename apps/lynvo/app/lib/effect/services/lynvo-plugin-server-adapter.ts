import {
  getLynvoManifestExtension,
  matchPluginServerUrl,
  type PluginServerManifest,
  type PluginMetadata,
  type HttpBasicAuth,
} from "@lynvo/plugin-server-protocol"
import { Effect } from "effect"
import { LYNVO_PLUGIN_SERVER_ID } from "../../constants"
import {
  PluginServerClient,
  ServiceBindingPluginServerTransport,
} from "../../extraction/plugin-server-client"
import { ExtractionError } from "../errors"
import type { ExtractionResult, MetadataResult } from "./extraction-types"
import {
  extractPluginServerResponse,
  requestPluginServer,
} from "./plugin-server-adapter-runtime"
import {
  getPluginServerMetadata,
  mapPluginServerExtractionResult,
} from "./plugin-server-result-mapping"

const createLynvoPluginServerClient = (environment: Env) =>
  new PluginServerClient(
    new ServiceBindingPluginServerTransport(environment.LYNVO_PLUGIN_SERVER)
  )

export const getLynvoPluginServerManifest = Effect.fn(
  "LynvoPluginServerAdapter.getLynvoPluginServerManifest"
)(function* (environment: Env, requestId?: string) {
  return yield* requestPluginServer(
    () =>
      createLynvoPluginServerClient(environment).getManifest({
        apiKey: environment.LYNVO_PLUGIN_SERVER_API_KEY,
        requestId,
      }),
    "Lynvo Plugin Server"
  )
})

export const discoverLynvoPlugin = Effect.fn(
  "LynvoPluginServerAdapter.discoverLynvoPlugin"
)(function* (
  environment: Env,
  targetUrl: string,
  basicAuth?: HttpBasicAuth,
  requestId?: string
) {
  return yield* requestPluginServer(
    () =>
      createLynvoPluginServerClient(environment).discover(targetUrl, {
        apiKey: environment.LYNVO_PLUGIN_SERVER_API_KEY,
        basicAuth,
        requestId,
      }),
    targetUrl
  )
})

export const getLynvoPluginServerMetadata = (
  manifest: PluginServerManifest,
  targetUrl: string,
  pluginId?: string
): MetadataResult | undefined => {
  const source = findLynvoPlugin(manifest, targetUrl, pluginId)
  return source
    ? getPluginServerMetadata(
        manifest,
        LYNVO_PLUGIN_SERVER_ID,
        targetUrl,
        source.id
      )
    : undefined
}

export const findLynvoPlugin = (
  manifest: PluginServerManifest,
  targetUrl: string,
  pluginId?: string
): PluginMetadata | undefined => {
  const sources = getLynvoManifestExtension(manifest).plugins ?? []
  return pluginId
    ? sources.find((candidate) => candidate.id === pluginId)
    : sources.find(
        (candidate) =>
          candidate.credential === undefined &&
          matchPluginServerUrl(targetUrl, candidate.matchers ?? [])
      )
}

export const extractFromLynvoPluginServer = Effect.fn(
  "LynvoPluginServerAdapter.extractFromLynvoPluginServer"
)(function* (
  environment: Env,
  targetUrl: string,
  kind: "source" | "node",
  credentials: {
    pluginId: string
    password?: string
    basicAuth?: { username: string; password: string }
  },
  requestId?: string
): Effect.fn.Return<ExtractionResult, ExtractionError> {
  const client = createLynvoPluginServerClient(environment)
  const options = {
    apiKey: environment.LYNVO_PLUGIN_SERVER_API_KEY,
    requestId,
    ...credentials,
  }
  const result = yield* requestPluginServer(
    () => extractPluginServerResponse(client, targetUrl, kind, options),
    targetUrl
  )
  return mapPluginServerExtractionResult(result, LYNVO_PLUGIN_SERVER_ID)
})

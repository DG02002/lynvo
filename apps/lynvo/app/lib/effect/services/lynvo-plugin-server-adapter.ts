import {
  getLynvoManifestExtension,
  matchPluginServerUrl,
  type PluginServerManifest,
  type PluginMetadata,
  type HttpBasicAuth,
} from "@dg02002/lynvo-plugin-server-protocol"
import { Effect } from "effect"
import { LYNVO_PLUGIN_SERVER_ID } from "../../constants"
import {
  PluginServerClient,
  ServiceBindingPluginServerTransport,
} from "../../extraction/plugin-server-client"
import type { ExtractionError } from "../errors"
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
)(function* (environment: Env, requestId?: string, operationId?: string) {
  return yield* requestPluginServer(
    () =>
      createLynvoPluginServerClient(environment).getManifest({
        apiKey: environment.MANAGED_PLUGIN_SERVER_API_KEY,
        requestId,
        operationId,
      }),
    "Lynvo Plugin Server"
  )
})

interface DiscoverLynvoPluginInput {
  readonly environment: Env
  readonly targetUrl: string
  readonly basicAuth?: HttpBasicAuth
  readonly requestId?: string
  readonly operationId?: string
}

export const discoverLynvoPlugin = Effect.fn(
  "LynvoPluginServerAdapter.discoverLynvoPlugin"
)(function* ({
  environment,
  targetUrl,
  basicAuth,
  requestId,
  operationId,
}: DiscoverLynvoPluginInput) {
  return yield* requestPluginServer(
    () =>
      createLynvoPluginServerClient(environment).discover(targetUrl, {
        apiKey: environment.MANAGED_PLUGIN_SERVER_API_KEY,
        basicAuth,
        requestId,
        operationId,
      }),
    targetUrl
  )
})

export const getLynvoPluginServerMetadata = (
  manifest: PluginServerManifest,
  targetUrl: string,
  pluginId?: string
): MetadataResult | undefined => {
  const source = findLynvoPlugin({ manifest, targetUrl, pluginId })
  return source
    ? getPluginServerMetadata({
        manifest,
        pluginServerId: LYNVO_PLUGIN_SERVER_ID,
        targetUrl,
        pluginId: source.id,
      })
    : undefined
}

interface FindLynvoPluginInput {
  readonly manifest: PluginServerManifest
  readonly targetUrl: string
  readonly pluginId?: string
  readonly allowProbe?: boolean
}

export const findLynvoPlugin = ({
  manifest,
  targetUrl,
  pluginId,
  allowProbe = true,
}: FindLynvoPluginInput): PluginMetadata | undefined => {
  const sources = getLynvoManifestExtension(manifest).plugins ?? []
  if (pluginId) {
    return sources.find((candidate) => candidate.id === pluginId)
  }
  const staticMatch = sources.find(
    (candidate) =>
      candidate.matchStrategy !== "probe" &&
      matchPluginServerUrl(targetUrl, candidate.matchers ?? [])
  )
  if (staticMatch) {
    return staticMatch
  }
  return allowProbe
    ? sources.find((candidate) => candidate.matchStrategy === "probe")
    : undefined
}

interface LynvoPluginServerCredentials {
  readonly pluginId: string
  readonly password?: string
  readonly basicAuth?: { username: string; password: string }
}

interface ExtractFromLynvoPluginServerInput {
  readonly environment: Env
  readonly targetUrl: string
  readonly kind: "source" | "node"
  readonly credentials: LynvoPluginServerCredentials
  readonly requestId?: string
  readonly operationId?: string
  readonly source?: PluginMetadata
}

export const extractFromLynvoPluginServer = Effect.fn(
  "LynvoPluginServerAdapter.extractFromLynvoPluginServer"
)(function* ({
  environment,
  targetUrl,
  kind,
  credentials,
  requestId,
  operationId,
  source,
}: ExtractFromLynvoPluginServerInput): Effect.fn.Return<
  ExtractionResult,
  ExtractionError
> {
  const client = createLynvoPluginServerClient(environment)
  const requestOptions = {
    apiKey: environment.MANAGED_PLUGIN_SERVER_API_KEY,
    requestId,
    operationId,
    ...credentials,
  }
  const result = yield* requestPluginServer(
    () =>
      extractPluginServerResponse({ client, targetUrl, kind, requestOptions }),
    targetUrl
  )
  return mapPluginServerExtractionResult(result, LYNVO_PLUGIN_SERVER_ID, source)
})

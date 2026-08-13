import { Effect } from "effect"
import {
  getLynvoManifestExtension,
  getMatchedPlugin,
  parsePluginServerManifestContract,
  type PluginMetadata,
  type HttpBasicAuth,
} from "@dg02002/lynvo-plugin-server-protocol"
import { extractHttpBasicCredential } from "../../plugins/http-basic-credential"
import { matchUrl } from "../../../lib/plugin-server-utils"
import type { ExtractionError } from "../errors"
import type {
  ExtractionResult,
  MetadataResult,
  RegisteredPluginServer,
} from "./extraction-types"
import { isPluginServerUsable } from "./plugin-server-verification-status"
import {
  PluginServerClient,
  HttpPluginServerTransport,
} from "../../extraction/plugin-server-client"
import {
  extractPluginServerResponse,
  requestPluginServer,
} from "./plugin-server-adapter-runtime"
import {
  getPluginServerMetadata,
  mapPluginServerExtractionResult,
} from "./plugin-server-result-mapping"

const createCustomPluginServerClient = (pluginServer: RegisteredPluginServer) =>
  new PluginServerClient(new HttpPluginServerTransport(pluginServer.baseUrl))

const parseStoredPluginServerManifest = <Value>(value: Value) => {
  const parsed = parsePluginServerManifestContract(value)
  return parsed.ok ? parsed.value : undefined
}

export const getCustomPluginServerUsage = Effect.fn(
  "CustomPluginServerAdapter.getCustomPluginServerUsage"
)(function* (pluginServer: RegisteredPluginServer) {
  const usage = yield* requestPluginServer(
    () =>
      createCustomPluginServerClient(pluginServer).getUsage({
        apiKey: pluginServer.apiKey,
      }),
    pluginServer.baseUrl
  )
  const manifest = yield* decodePluginServerManifest(pluginServer.manifest)
  const baseUsage = {
    pluginServerId: pluginServer._id,
    name: manifest?.displayName ?? pluginServer.baseUrl,
    metrics: usage.metrics,
  }
  if (!manifest) {
    return baseUsage
  }
  const plugins = (getLynvoManifestExtension(manifest).plugins ?? []).map(
    (source) =>
      source.iconUrl
        ? { id: source.id, name: source.displayName, iconUrl: source.iconUrl }
        : { id: source.id, name: source.displayName }
  )
  const usageWithPlugins = { ...baseUsage, plugins }
  return manifest.iconUrl
    ? { ...usageWithPlugins, iconUrl: manifest.iconUrl }
    : usageWithPlugins
})

export const decodePluginServerManifest = Effect.fn(
  "CustomPluginServerAdapter.decodePluginServerManifest"
)(function* (value: string) {
  const json = yield* Effect.try(() => JSON.parse(value)).pipe(
    Effect.catch(() => Effect.succeed(undefined))
  )
  if (json === undefined) {
    return undefined
  }
  return parseStoredPluginServerManifest(json)
})

export const selectCustomPluginServer = Effect.fn(
  "CustomPluginServerAdapter.selectCustomPluginServer"
)(function* (
  pluginServers: ReadonlyArray<RegisteredPluginServer>,
  targetUrl: string,
  pluginServerId?: string
) {
  if (pluginServerId) {
    return pluginServers.find(
      (pluginServer) =>
        pluginServer._id === pluginServerId &&
        isPluginServerUsable(pluginServer)
    )
  }

  const enabledPluginServers = [...pluginServers]
    .filter(isPluginServerUsable)
    .sort((left, right) => right.priority - left.priority)

  for (const pluginServer of enabledPluginServers) {
    const manifest = yield* decodePluginServerManifest(pluginServer.manifest)
    if (manifest && matchUrl(targetUrl, manifest.matchers)) {
      return pluginServer
    }
  }

  return undefined
})

export const getCustomPluginServerMetadata = Effect.fn(
  "CustomPluginServerAdapter.getCustomPluginServerMetadata"
)(function* (
  pluginServer: RegisteredPluginServer,
  targetUrl?: string,
  pluginId?: string
): Effect.fn.Return<MetadataResult | undefined> {
  const manifest = yield* decodePluginServerManifest(pluginServer.manifest)
  if (!manifest) {
    return undefined
  }
  return getPluginServerMetadata(
    manifest,
    pluginServer._id,
    targetUrl,
    pluginId
  )
})

export const getCustomPlugin = Effect.fn(
  "CustomPluginServerAdapter.getCustomPlugin"
)(function* (
  pluginServer: RegisteredPluginServer,
  targetUrl: string,
  pluginId?: string
): Effect.fn.Return<PluginMetadata | undefined> {
  const manifest = yield* decodePluginServerManifest(pluginServer.manifest)
  return manifest
    ? pluginId
      ? getLynvoManifestExtension(manifest).plugins?.find(
          (source) => source.id === pluginId
        )
      : getMatchedPlugin(manifest, targetUrl)
    : undefined
})

export const discoverCustomPlugin = Effect.fn(
  "CustomPluginServerAdapter.discoverCustomPlugin"
)(function* (
  pluginServer: RegisteredPluginServer,
  targetUrl: string,
  basicAuth?: HttpBasicAuth,
  requestId?: string
) {
  const manifest = yield* decodePluginServerManifest(pluginServer.manifest)
  if (!manifest?.features.discovery) {
    return undefined
  }
  return yield* requestPluginServer(
    () =>
      createCustomPluginServerClient(pluginServer).discover(targetUrl, {
        apiKey: pluginServer.apiKey,
        basicAuth,
        requestId,
      }),
    targetUrl
  )
})

export const extractFromCustomPluginServer = Effect.fn(
  "CustomPluginServerAdapter.extractFromCustomPluginServer"
)(function* (
  pluginServer: RegisteredPluginServer,
  targetUrl: string,
  kind: "source" | "node",
  credentials?: {
    password?: string
    basicAuth?: HttpBasicAuth
    pluginId?: string
  },
  requestId?: string
): Effect.fn.Return<ExtractionResult, ExtractionError> {
  const manifest = yield* decodePluginServerManifest(pluginServer.manifest)
  const extractedAuth = extractHttpBasicCredential(targetUrl)
  const basicAuth = manifest?.features.basicAuth
    ? (extractedAuth.basicAuth ?? credentials?.basicAuth)
    : undefined
  const client = createCustomPluginServerClient(pluginServer)
  const resultValue = yield* requestPluginServer(
    () =>
      extractPluginServerResponse(client, extractedAuth.url, kind, {
        apiKey: pluginServer.apiKey,
        password: credentials?.password,
        basicAuth,
        pluginId: credentials?.pluginId,
        requestId,
      }),
    targetUrl
  )
  return mapPluginServerExtractionResult(resultValue, pluginServer._id)
})

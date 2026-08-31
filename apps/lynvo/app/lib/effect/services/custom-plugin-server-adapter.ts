import { Effect } from "effect"
import {
  getLynvoManifestExtension,
  getMatchedPlugin,
  parsePluginServerManifestContract,
  type PluginMetadata,
  type HttpBasicAuth,
  type ProxyCredential,
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
    pluginServerId: pluginServer.id,
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
        pluginServer.id === pluginServerId && isPluginServerUsable(pluginServer)
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
  return getPluginServerMetadata({
    manifest,
    pluginServerId: pluginServer.id,
    targetUrl,
    pluginId,
  })
})

export const getCustomPlugin = Effect.fn(
  "CustomPluginServerAdapter.getCustomPlugin"
)(function* (
  pluginServer: RegisteredPluginServer,
  targetUrl: string,
  pluginId?: string
): Effect.fn.Return<PluginMetadata | undefined> {
  const manifest = yield* decodePluginServerManifest(pluginServer.manifest)
  if (!manifest) {
    return undefined
  }

  if (pluginId) {
    return getLynvoManifestExtension(manifest).plugins?.find(
      (source) => source.id === pluginId
    )
  }

  return getMatchedPlugin(manifest, targetUrl)
})

interface DiscoverCustomPluginInput {
  readonly pluginServer: RegisteredPluginServer
  readonly targetUrl: string
  readonly basicAuth?: HttpBasicAuth
  readonly requestId?: string
}

export const discoverCustomPlugin = Effect.fn(
  "CustomPluginServerAdapter.discoverCustomPlugin"
)(function* ({
  pluginServer,
  targetUrl,
  basicAuth,
  requestId,
}: DiscoverCustomPluginInput) {
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

interface CustomPluginServerCredentials {
  readonly password?: string
  readonly basicAuth?: HttpBasicAuth
  readonly pluginId?: string
}

interface ExtractFromCustomPluginServerInput {
  readonly pluginServer: RegisteredPluginServer
  readonly targetUrl: string
  readonly kind: "source" | "node"
  readonly credentials?: CustomPluginServerCredentials
  readonly requestId?: string
  readonly source?: PluginMetadata
}

export const extractFromCustomPluginServer = Effect.fn(
  "CustomPluginServerAdapter.extractFromCustomPluginServer"
)(function* ({
  pluginServer,
  targetUrl,
  kind,
  credentials,
  requestId,
  source,
}: ExtractFromCustomPluginServerInput): Effect.fn.Return<
  ExtractionResult,
  ExtractionError
> {
  const manifest = yield* decodePluginServerManifest(pluginServer.manifest)
  const extractedAuth = extractHttpBasicCredential(targetUrl)
  const basicAuth = manifest?.features.basicAuth
    ? (extractedAuth.basicAuth ?? credentials?.basicAuth)
    : undefined
  const proxy: ProxyCredential | undefined =
    manifest &&
    getLynvoManifestExtension(manifest).proxyProvider === "scrape-do" &&
    pluginServer.proxyToken
      ? { provider: "scrape-do", token: pluginServer.proxyToken }
      : undefined
  const client = createCustomPluginServerClient(pluginServer)
  const resultValue = yield* requestPluginServer(
    () =>
      extractPluginServerResponse({
        client,
        targetUrl: extractedAuth.url,
        kind,
        requestOptions: {
          apiKey: pluginServer.apiKey,
          password: credentials?.password,
          basicAuth,
          pluginId: credentials?.pluginId,
          proxy,
          requestId,
        },
      }),
    targetUrl
  )
  return mapPluginServerExtractionResult(resultValue, pluginServer.id, source)
})

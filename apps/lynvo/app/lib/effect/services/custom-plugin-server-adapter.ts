import { Effect } from "effect"
import {
  getLynvoManifestExtension,
  getMatchedPlugin,
  pluginServerManifestSchema,
  type ExtractSuccessResponse,
  type PluginServerManifest,
  type PluginMetadata,
  type HttpBasicAuth,
} from "@lynvo/plugin-server-protocol"
import { extractHttpBasicCredential } from "../../plugins/http-basic-credential"
import {
  matchUrl,
  mapNodeToExtractedLink,
} from "../../../lib/plugin-server-utils"
import {
  decodeExtractionText,
  normalizeExtractionText,
} from "../../extraction/extraction-text-normalization"
import { ExtractionError } from "../errors"
import type {
  ExtractionResult,
  MetadataResult,
  RegisteredPluginServer,
} from "./extraction-types"
import { isPluginServerUsable } from "./plugin-server-verification-status"
import {
  PluginServerClient,
  PluginServerClientError,
  HttpPluginServerTransport,
} from "../../extraction/plugin-server-client"

const createCustomPluginServerClient = (pluginServer: RegisteredPluginServer) =>
  new PluginServerClient(new HttpPluginServerTransport(pluginServer.baseUrl))

const customPluginServerError = (
  cause: unknown,
  url: string
): ExtractionError =>
  new ExtractionError({
    message:
      cause instanceof PluginServerClientError
        ? cause.code
        : "TEMPORARY_FAILURE",
    url,
  })

export const getCustomPluginServerUsage = Effect.fn(
  "CustomPluginServerAdapter.getCustomPluginServerUsage"
)(function* (pluginServer: RegisteredPluginServer) {
  const usage = yield* Effect.tryPromise({
    try: () =>
      createCustomPluginServerClient(pluginServer).getUsage({
        apiKey: pluginServer.apiKey,
      }),
    catch: (cause) => customPluginServerError(cause, pluginServer.baseUrl),
  })
  const manifest = yield* decodePluginServerManifest(pluginServer.manifest)
  return {
    pluginServerId: pluginServer._id,
    name: manifest?.displayName ?? pluginServer.baseUrl,
    ...(manifest?.iconUrl ? { iconUrl: manifest.iconUrl } : {}),
    ...(manifest
      ? {
          plugins: (getLynvoManifestExtension(manifest).plugins ?? []).map(
            (source) => ({
              id: source.id,
              name: source.displayName,
              ...(source.iconUrl ? { iconUrl: source.iconUrl } : {}),
            })
          ),
        }
      : {}),
    metrics: usage.metrics,
  }
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
  const parsed = pluginServerManifestSchema.safeParse(json)
  return parsed.success ? parsed.data : undefined
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
  targetUrl?: string
): Effect.fn.Return<MetadataResult | undefined> {
  const manifest = yield* decodePluginServerManifest(pluginServer.manifest)
  if (!manifest) {
    return undefined
  }
  return getPluginServerMetadata(manifest, pluginServer._id, targetUrl)
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
  return yield* Effect.tryPromise({
    try: () =>
      createCustomPluginServerClient(pluginServer).discover(targetUrl, {
        apiKey: pluginServer.apiKey,
        basicAuth,
        requestId,
      }),
    catch: (cause) => customPluginServerError(cause, targetUrl),
  })
})

export const getPluginServerMetadata = (
  manifest: PluginServerManifest,
  pluginServerId: string,
  targetUrl?: string,
  pluginId?: string
): MetadataResult => {
  const source = pluginId
    ? getLynvoManifestExtension(manifest).plugins?.find(
        (candidate) => candidate.id === pluginId
      )
    : targetUrl
      ? getMatchedPlugin(manifest, targetUrl)
      : undefined
  const routeSourceId = source?.routesToPluginId
  const routeSource = routeSourceId
    ? getLynvoManifestExtension(manifest).plugins?.find(
        (candidate) => candidate.id === routeSourceId
      )
    : undefined

  return {
    filename: "",
    pluginName: decodeExtractionText(manifest.displayName),
    ...(manifest.iconUrl ? { pluginIcon: manifest.iconUrl } : {}),
    ...(source?.id ? { pluginId: source.id } : {}),
    ...(source?.displayName
      ? { sourceName: decodeExtractionText(source.displayName) }
      : {}),
    ...(source?.iconUrl ? { sourceIconUrl: source.iconUrl } : {}),
    ...(source?.status ? { sourceStatus: source.status } : {}),
    ...(source?.version ? { sourceVersion: source.version } : {}),
    ...(source?.credential
      ? { sourceCredentialKind: source.credential.kind }
      : {}),
    ...(routeSource?.displayName
      ? { routeSourceName: decodeExtractionText(routeSource.displayName) }
      : {}),
    ...(routeSource?.iconUrl
      ? { routeSourceIconUrl: routeSource.iconUrl }
      : {}),
    pluginServerId,
  }
}

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
  const resultValue = yield* Effect.tryPromise({
    try: () =>
      kind === "node"
        ? client.extractNode(extractedAuth.url, {
            apiKey: pluginServer.apiKey,
            password: credentials?.password,
            basicAuth,
            pluginId: credentials?.pluginId,
            requestId,
          })
        : client.extractSource(extractedAuth.url, {
            apiKey: pluginServer.apiKey,
            password: credentials?.password,
            basicAuth,
            pluginId: credentials?.pluginId,
            requestId,
          }),
    catch: (cause) => customPluginServerError(cause, targetUrl),
  })
  return mapExtractionResult(resultValue, pluginServer._id)
})

export const mapExtractionResult = (
  resultValue: ExtractSuccessResponse,
  pluginServerId: string
): ExtractionResult => {
  const result = normalizeExtractionText(resultValue)

  return {
    links: result.nodes.map(mapNodeToExtractedLink),
    meta: {
      pluginName: result.plugin.displayName || result.plugin.pluginServerId,
      ...(result.plugin.iconUrl ? { pluginIcon: result.plugin.iconUrl } : {}),
      ...(result.plugin.pluginId ? { pluginId: result.plugin.pluginId } : {}),
      ...(result.plugin.pluginName
        ? { sourceName: result.plugin.pluginName }
        : {}),
      ...(result.plugin.pluginIconUrl
        ? { sourceIconUrl: result.plugin.pluginIconUrl }
        : {}),
      ...(result.plugin.pageTitle
        ? { pageTitle: result.plugin.pageTitle }
        : {}),
      ...(result.plugin.audio ? { audio: result.plugin.audio } : {}),
      schemaVersion: 3,
      pluginServerId,
    },
  }
}

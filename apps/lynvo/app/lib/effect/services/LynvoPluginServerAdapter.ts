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
  ExtractorProtocolClient,
  ExtractorProtocolClientError,
  ServiceBindingExtractorTransport,
} from "../../extraction/extractor-protocol-client"
import { ExtractionError } from "../errors"
import type { ExtractionResult, MetadataResult } from "./extractor-types"
import {
  getExtractorMetadata,
  mapExtractorResult,
} from "./WorkerExtractorAdapter"

const officialError = (cause: unknown, url: string) =>
  new ExtractionError({
    message:
      cause instanceof ExtractorProtocolClientError
        ? cause.code
        : "TEMPORARY_FAILURE",
    url,
  })

const createOfficialClient = (environment: Env) =>
  new ExtractorProtocolClient(
    new ServiceBindingExtractorTransport(environment.LYNVO_PLUGIN_SERVER)
  )

export const getOfficialManifest = Effect.fn(
  "LynvoPluginServerAdapter.getOfficialManifest"
)(function* (environment: Env, requestId?: string) {
  return yield* Effect.tryPromise({
    try: () =>
      createOfficialClient(environment).getManifest({
        apiKey: environment.LYNVO_PLUGIN_SERVER_API_KEY,
        requestId,
      }),
    catch: (cause) => officialError(cause, "Lynvo Plugin Server"),
  })
})

export const discoverOfficialSource = Effect.fn(
  "LynvoPluginServerAdapter.discoverOfficialSource"
)(function* (
  environment: Env,
  targetUrl: string,
  basicAuth?: HttpBasicAuth,
  requestId?: string
) {
  return yield* Effect.tryPromise({
    try: () =>
      createOfficialClient(environment).discover(targetUrl, {
        apiKey: environment.LYNVO_PLUGIN_SERVER_API_KEY,
        basicAuth,
        requestId,
      }),
    catch: (cause) => officialError(cause, targetUrl),
  })
})

export const getOfficialMetadata = (
  manifest: PluginServerManifest,
  targetUrl: string,
  pluginId?: string
): MetadataResult | undefined => {
  const source = findOfficialManifestSource(manifest, targetUrl, pluginId)
  return source
    ? getExtractorMetadata(
        manifest,
        LYNVO_PLUGIN_SERVER_ID,
        targetUrl,
        source.id
      )
    : undefined
}

export const findOfficialManifestSource = (
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

export const extractFromOfficial = Effect.fn(
  "LynvoPluginServerAdapter.extractFromOfficial"
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
  const client = createOfficialClient(environment)
  const options = {
    apiKey: environment.LYNVO_PLUGIN_SERVER_API_KEY,
    requestId,
    ...credentials,
  }
  const result = yield* Effect.tryPromise({
    try: () =>
      kind === "node"
        ? client.extractNode(targetUrl, options)
        : client.extractSource(targetUrl, options),
    catch: (cause) => officialError(cause, targetUrl),
  })
  return mapExtractorResult(result, LYNVO_PLUGIN_SERVER_ID)
})

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
import { matchUrl, mapNodeToExtractedLink } from "../../../lib/worker-utils"
import {
  decodeExtractorText,
  normalizeExtractorText,
} from "../../extraction/extractor-text-normalization"
import { ExtractionError } from "../errors"
import type {
  ExtractionResult,
  MetadataResult,
  RegisteredWorker,
} from "./extractor-types"
import { isWorkerUsable } from "./worker-verification-status"
import {
  ExtractorProtocolClient,
  ExtractorProtocolClientError,
  HttpExtractorTransport,
} from "../../extraction/extractor-protocol-client"

const createWorkerClient = (worker: RegisteredWorker) =>
  new ExtractorProtocolClient(new HttpExtractorTransport(worker.baseUrl))

const workerError = (cause: unknown, url: string): ExtractionError =>
  new ExtractionError({
    message:
      cause instanceof ExtractorProtocolClientError
        ? cause.code
        : "TEMPORARY_FAILURE",
    url,
  })

export const getWorkerUsage = Effect.fn(
  "WorkerExtractorAdapter.getWorkerUsage"
)(function* (worker: RegisteredWorker) {
  const usage = yield* Effect.tryPromise({
    try: () => createWorkerClient(worker).getUsage({ apiKey: worker.apiKey }),
    catch: (cause) => workerError(cause, worker.baseUrl),
  })
  const manifest = yield* decodeWorkerManifest(worker.manifest)
  return {
    workerId: worker._id,
    name: manifest?.displayName ?? worker.baseUrl,
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

export const decodeWorkerManifest = Effect.fn(
  "WorkerExtractorAdapter.decodeWorkerManifest"
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

export const selectWorker = Effect.fn("WorkerExtractorAdapter.selectWorker")(
  function* (
    workers: ReadonlyArray<RegisteredWorker>,
    targetUrl: string,
    workerId?: string
  ) {
    if (workerId) {
      return workers.find(
        (worker) => worker._id === workerId && isWorkerUsable(worker)
      )
    }

    const enabledWorkers = [...workers]
      .filter(isWorkerUsable)
      .sort((left, right) => right.priority - left.priority)

    for (const worker of enabledWorkers) {
      const manifest = yield* decodeWorkerManifest(worker.manifest)
      if (manifest && matchUrl(targetUrl, manifest.matchers)) {
        return worker
      }
    }

    return undefined
  }
)

export const getWorkerMetadata = Effect.fn(
  "WorkerExtractorAdapter.getWorkerMetadata"
)(function* (
  worker: RegisteredWorker,
  targetUrl?: string
): Effect.fn.Return<MetadataResult | undefined> {
  const manifest = yield* decodeWorkerManifest(worker.manifest)
  if (!manifest) {
    return undefined
  }
  return getExtractorMetadata(manifest, worker._id, targetUrl)
})

export const getWorkerSource = Effect.fn(
  "WorkerExtractorAdapter.getWorkerSource"
)(function* (
  worker: RegisteredWorker,
  targetUrl: string,
  pluginId?: string
): Effect.fn.Return<PluginMetadata | undefined> {
  const manifest = yield* decodeWorkerManifest(worker.manifest)
  return manifest
    ? pluginId
      ? getLynvoManifestExtension(manifest).plugins?.find(
          (source) => source.id === pluginId
        )
      : getMatchedPlugin(manifest, targetUrl)
    : undefined
})

export const discoverWorkerSource = Effect.fn(
  "WorkerExtractorAdapter.discoverWorkerSource"
)(function* (
  worker: RegisteredWorker,
  targetUrl: string,
  basicAuth?: HttpBasicAuth,
  requestId?: string
) {
  const manifest = yield* decodeWorkerManifest(worker.manifest)
  if (!manifest?.features.discovery) {
    return undefined
  }
  return yield* Effect.tryPromise({
    try: () =>
      createWorkerClient(worker).discover(targetUrl, {
        apiKey: worker.apiKey,
        basicAuth,
        requestId,
      }),
    catch: (cause) => workerError(cause, targetUrl),
  })
})

export const getExtractorMetadata = (
  manifest: PluginServerManifest,
  workerId: string,
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
    pluginName: decodeExtractorText(manifest.displayName),
    ...(manifest.iconUrl ? { pluginIcon: manifest.iconUrl } : {}),
    ...(source?.id ? { pluginId: source.id } : {}),
    ...(source?.displayName
      ? { sourceName: decodeExtractorText(source.displayName) }
      : {}),
    ...(source?.iconUrl ? { sourceIconUrl: source.iconUrl } : {}),
    ...(source?.status ? { sourceStatus: source.status } : {}),
    ...(source?.version ? { sourceVersion: source.version } : {}),
    ...(source?.credential
      ? { sourceCredentialKind: source.credential.kind }
      : {}),
    ...(routeSource?.displayName
      ? { routeSourceName: decodeExtractorText(routeSource.displayName) }
      : {}),
    ...(routeSource?.iconUrl
      ? { routeSourceIconUrl: routeSource.iconUrl }
      : {}),
    workerId,
  }
}

export const extractFromWorker = Effect.fn(
  "WorkerExtractorAdapter.extractFromWorker"
)(function* (
  worker: RegisteredWorker,
  targetUrl: string,
  kind: "source" | "node",
  credentials?: {
    password?: string
    basicAuth?: HttpBasicAuth
    pluginId?: string
  },
  requestId?: string
): Effect.fn.Return<ExtractionResult, ExtractionError> {
  const manifest = yield* decodeWorkerManifest(worker.manifest)
  const extractedAuth = extractHttpBasicCredential(targetUrl)
  const basicAuth = manifest?.features.basicAuth
    ? (extractedAuth.basicAuth ?? credentials?.basicAuth)
    : undefined
  const client = createWorkerClient(worker)
  const resultValue = yield* Effect.tryPromise({
    try: () =>
      kind === "node"
        ? client.extractNode(extractedAuth.url, {
            apiKey: worker.apiKey,
            password: credentials?.password,
            basicAuth,
            pluginId: credentials?.pluginId,
            requestId,
          })
        : client.extractSource(extractedAuth.url, {
            apiKey: worker.apiKey,
            password: credentials?.password,
            basicAuth,
            pluginId: credentials?.pluginId,
            requestId,
          }),
    catch: (cause) => workerError(cause, targetUrl),
  })
  return mapExtractorResult(resultValue, worker._id)
})

export const mapExtractorResult = (
  resultValue: ExtractSuccessResponse,
  workerId: string
): ExtractionResult => {
  const result = normalizeExtractorText(resultValue)

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
      schemaVersion: 2,
      workerId,
    },
  }
}

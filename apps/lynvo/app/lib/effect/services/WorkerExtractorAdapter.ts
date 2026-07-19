import { Effect } from "effect"
import {
  getLynvoManifestExtension,
  getMatchedExtractorSource,
  manifestSchema,
  type ExtractSuccessResponse,
  type ExtractorManifest,
} from "@lynvo/extractor-protocol"
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
  const parsed = manifestSchema.safeParse(json)
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

export const getExtractorMetadata = (
  manifest: ExtractorManifest,
  workerId: string,
  targetUrl?: string,
  sourceId?: string
): MetadataResult => {
  const source = sourceId
    ? getLynvoManifestExtension(manifest).sources?.find(
        (candidate) => candidate.id === sourceId
      )
    : targetUrl
      ? getMatchedExtractorSource(manifest, targetUrl)
      : undefined
  const routeSourceId =
    source?.routesToSourceId ??
    (manifest.extractorId === "com.lynvo.plnkextractor" &&
    source?.id === "hubdrive"
      ? "hubcloud"
      : undefined)
  const routeSource = routeSourceId
    ? getLynvoManifestExtension(manifest).sources?.find(
        (candidate) => candidate.id === routeSourceId
      )
    : undefined

  return {
    filename: "",
    pluginName: decodeExtractorText(manifest.displayName),
    ...(manifest.iconUrl ? { pluginIcon: manifest.iconUrl } : {}),
    ...(source?.id ? { sourceId: source.id } : {}),
    ...(source?.displayName
      ? { sourceName: decodeExtractorText(source.displayName) }
      : {}),
    ...(source?.iconUrl ? { sourceIconUrl: source.iconUrl } : {}),
    ...(source?.status ? { sourceStatus: source.status } : {}),
    ...(source?.version ? { sourceVersion: source.version } : {}),
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
  password?: string,
  requestId?: string
): Effect.fn.Return<ExtractionResult, ExtractionError> {
  const manifest = yield* decodeWorkerManifest(worker.manifest)
  const extractedAuth = extractHttpBasicCredential(targetUrl)
  const basicAuth = manifest?.features.basicAuth
    ? extractedAuth.basicAuth
    : undefined
  const client = createWorkerClient(worker)
  const resultValue = yield* Effect.tryPromise({
    try: () =>
      kind === "node"
        ? client.extractNode(extractedAuth.url, {
            apiKey: worker.apiKey,
            password,
            basicAuth,
            requestId,
          })
        : client.extractSource(extractedAuth.url, {
            apiKey: worker.apiKey,
            password,
            basicAuth,
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
      pluginName: result.source.displayName || result.source.extractorId,
      ...(result.source.iconUrl ? { pluginIcon: result.source.iconUrl } : {}),
      ...(result.source.sourceId ? { sourceId: result.source.sourceId } : {}),
      ...(result.source.sourceName
        ? { sourceName: result.source.sourceName }
        : {}),
      ...(result.source.sourceIconUrl
        ? { sourceIconUrl: result.source.sourceIconUrl }
        : {}),
      ...(result.source.pageTitle
        ? { pageTitle: result.source.pageTitle }
        : {}),
      ...(result.source.audio ? { audio: result.source.audio } : {}),
      schemaVersion: 2,
      workerId,
    },
  }
}

import { Effect } from "effect"
import {
  createNodeExtractRequest,
  createSourceExtractRequest,
  extractSuccessSchema,
  getLynvoManifestExtension,
  getMatchedExtractorSource,
  manifestSchema,
  usageResponseSchema,
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

export const getWorkerUsage = Effect.fn(
  "WorkerExtractorAdapter.getWorkerUsage"
)(function* (worker: RegisteredWorker) {
  const response = yield* Effect.tryPromise({
    try: () =>
      fetch(`${worker.baseUrl.replace(/\/$/, "")}/usage`, {
        headers: { Authorization: `Bearer ${worker.apiKey}` },
      }),
    catch: (cause) =>
      new ExtractionError({
        message:
          cause instanceof Error
            ? cause.message
            : "Worker usage request failed",
        url: worker.baseUrl,
      }),
  })
  if (!response.ok) {
    return yield* new ExtractionError({
      message: `Worker usage request failed with HTTP ${response.status}`,
      url: worker.baseUrl,
    })
  }
  const value = yield* Effect.tryPromise({
    try: () => response.json(),
    catch: () =>
      new ExtractionError({
        message: "Worker returned malformed usage JSON",
        url: worker.baseUrl,
      }),
  })
  const usage = usageResponseSchema.safeParse(value)
  if (!usage.success) {
    return yield* new ExtractionError({
      message: "Worker usage response does not match protocol v1",
      url: worker.baseUrl,
    })
  }
  const manifest = yield* decodeWorkerManifest(worker.manifest)
  return {
    workerId: worker._id,
    name: manifest?.displayName ?? worker.baseUrl,
    metrics: usage.data.metrics,
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
  const source = targetUrl
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
    workerId: worker._id,
  }
})

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
  const response = yield* Effect.tryPromise({
    try: () =>
      fetch(`${worker.baseUrl.replace(/\/$/, "")}/extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${worker.apiKey}`,
          ...(requestId ? { "x-request-id": requestId } : {}),
        },
        body: JSON.stringify(
          kind === "node"
            ? createNodeExtractRequest(extractedAuth.url, password, basicAuth)
            : createSourceExtractRequest(extractedAuth.url, password, basicAuth)
        ),
      }),
    catch: (cause) =>
      new ExtractionError({
        message:
          cause instanceof Error ? cause.message : "Worker request failed",
        url: targetUrl,
      }),
  })

  if (!response.ok) {
    const message = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: () =>
        new ExtractionError({
          message: "Worker extraction failed",
          url: targetUrl,
        }),
    })
    return yield* new ExtractionError({
      message: message || "Worker extraction failed",
      url: targetUrl,
    })
  }

  const json = yield* Effect.tryPromise({
    try: () => response.json(),
    catch: () =>
      new ExtractionError({
        message: "Worker returned malformed JSON",
        url: targetUrl,
      }),
  })

  const parsed = extractSuccessSchema.safeParse(json)
  if (!parsed.success) {
    return yield* new ExtractionError({
      message: "Worker response does not match protocol v1",
      url: targetUrl,
    })
  }
  const result = normalizeExtractorText(parsed.data)

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
      workerId: worker._id,
    },
  }
})

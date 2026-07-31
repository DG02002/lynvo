import {
  getLynvoManifestExtension,
  matchExtractorUrl,
  type ExtractorManifest,
  type ExtractorSourceMetadata,
  type HttpBasicAuth,
} from "@lynvo/extractor-protocol"
import { Effect } from "effect"
import { OFFICIAL_EXTRACTOR_ID } from "../../constants"
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
    new ServiceBindingExtractorTransport(environment.OFFICIAL_EXTRACTOR)
  )

export const getOfficialManifest = Effect.fn(
  "OfficialExtractorAdapter.getOfficialManifest"
)(function* (environment: Env, requestId?: string) {
  return yield* Effect.tryPromise({
    try: () =>
      createOfficialClient(environment).getManifest({
        apiKey: environment.OFFICIAL_EXTRACTOR_API_KEY,
        requestId,
      }),
    catch: (cause) => officialError(cause, "official extractor"),
  })
})

export const discoverOfficialSource = Effect.fn(
  "OfficialExtractorAdapter.discoverOfficialSource"
)(function* (
  environment: Env,
  targetUrl: string,
  basicAuth?: HttpBasicAuth,
  requestId?: string
) {
  return yield* Effect.tryPromise({
    try: () =>
      createOfficialClient(environment).discover(targetUrl, {
        apiKey: environment.OFFICIAL_EXTRACTOR_API_KEY,
        basicAuth,
        requestId,
      }),
    catch: (cause) => officialError(cause, targetUrl),
  })
})

export const getOfficialMetadata = (
  manifest: ExtractorManifest,
  targetUrl: string,
  sourceId?: string
): MetadataResult | undefined => {
  const source = findOfficialManifestSource(manifest, targetUrl, sourceId)
  return source
    ? getExtractorMetadata(
        manifest,
        OFFICIAL_EXTRACTOR_ID,
        targetUrl,
        source.id
      )
    : undefined
}

export const findOfficialManifestSource = (
  manifest: ExtractorManifest,
  targetUrl: string,
  sourceId?: string
): ExtractorSourceMetadata | undefined => {
  const sources = getLynvoManifestExtension(manifest).sources ?? []
  return sourceId
    ? sources.find((candidate) => candidate.id === sourceId)
    : sources.find(
        (candidate) =>
          candidate.credential === undefined &&
          matchExtractorUrl(targetUrl, candidate.matchers ?? [])
      )
}

export const extractFromOfficial = Effect.fn(
  "OfficialExtractorAdapter.extractFromOfficial"
)(function* (
  environment: Env,
  targetUrl: string,
  kind: "source" | "node",
  credentials: {
    sourceId: string
    password?: string
    basicAuth?: { username: string; password: string }
  },
  requestId?: string
): Effect.fn.Return<ExtractionResult, ExtractionError> {
  const client = createOfficialClient(environment)
  const options = {
    apiKey: environment.OFFICIAL_EXTRACTOR_API_KEY,
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
  return mapExtractorResult(result, OFFICIAL_EXTRACTOR_ID)
})

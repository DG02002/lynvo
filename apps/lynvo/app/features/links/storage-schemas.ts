import { Schema } from "effect"
import type {
  ExtractedLink,
  LinkDebugLogEntry,
  LinkMetadata,
  MetaData,
} from "./types"

export const extractedLinkSchema: Schema.Codec<ExtractedLink> = Schema.suspend(
  (): Schema.Codec<ExtractedLink> =>
    Schema.Struct({
      nodeKey: Schema.optional(Schema.NonEmptyString),
      url: Schema.optional(Schema.NonEmptyString),
      nodeUrl: Schema.optional(Schema.NonEmptyString),
      resourceId: Schema.optional(Schema.NonEmptyString),
      label: Schema.String,
      id: Schema.optional(Schema.String),
      badge: Schema.optional(Schema.String),
      type: Schema.optional(Schema.Literals(["file", "folder"])),
      children: Schema.optional(
        Schema.mutable(
          Schema.Array(
            Schema.suspend(
              (): Schema.Codec<ExtractedLink> => extractedLinkSchema
            )
          )
        )
      ),
      childrenResolved: Schema.optional(Schema.Boolean),
      rangeRequest: Schema.optional(
        Schema.Literals(["supported", "unsupported", "unknown"])
      ),
      expiry: Schema.optional(Schema.Number),
      expirySource: Schema.optional(
        Schema.Literals(["signed-url", "expires-header", "cache-control"])
      ),
      status: Schema.optional(Schema.Literals(["up", "down"])),
      opened: Schema.optional(Schema.Boolean),
      size: Schema.optional(Schema.String),
      sourceName: Schema.optional(Schema.String),
      selectable: Schema.optional(Schema.Boolean),
      mediaNodeKind: Schema.Literals(["group", "resolvable", "playable"]),
      resolutionKind: Schema.optional(Schema.Literals(["folder", "mirrors"])),
    }).pipe(
      Schema.refine(
        (link): link is ExtractedLink => {
          if (link.mediaNodeKind === "playable" && !link.url) {
            return false
          }
          if (link.mediaNodeKind === "playable" && link.type !== "file") {
            return false
          }
          if (
            link.mediaNodeKind === "resolvable" &&
            !link.nodeUrl &&
            !link.resourceId
          ) {
            return false
          }
          if (link.mediaNodeKind === "group" && link.url) {
            return false
          }
          if (link.mediaNodeKind !== "playable" && link.type !== "folder") {
            return false
          }
          if (
            link.mediaNodeKind !== "resolvable" &&
            (link.nodeUrl || link.resourceId)
          ) {
            return false
          }
          return true
        },
        { message: "Invalid media node invariants" }
      )
    )
)

export const metadataSchema: Schema.Codec<MetaData> = Schema.Struct({
  filename: Schema.optional(Schema.String),
  contentType: Schema.optional(Schema.String),
  contentLength: Schema.optional(Schema.Number),
  lastModified: Schema.optional(Schema.String),
  rangeRequest: Schema.optional(
    Schema.Literals(["supported", "unsupported", "unknown"])
  ),
  pluginName: Schema.optional(Schema.String),
  pluginIcon: Schema.optional(Schema.String),
  pluginId: Schema.optional(Schema.String),
  sourceName: Schema.optional(Schema.String),
  sourceIconUrl: Schema.optional(Schema.String),
  sourceStatus: Schema.optional(
    Schema.Literals(["active", "maintenance", "degraded", "down"])
  ),
  sourceVersion: Schema.optional(Schema.String),
  sourceCredentialKind: Schema.optional(
    Schema.Literals(["domain-password", "http-basic"])
  ),
  routeSourceName: Schema.optional(Schema.String),
  routeSourceIconUrl: Schema.optional(Schema.String),
  audio: Schema.optional(Schema.String),
  pageTitle: Schema.optional(Schema.String),
  title: Schema.optional(Schema.String),
  badge: Schema.optional(Schema.String),
  pluginServerId: Schema.optional(Schema.String),
})

export const linkDebugLogEntrySchema: Schema.Codec<LinkDebugLogEntry> =
  Schema.Struct({
    at: Schema.Number,
    pluginServerId: Schema.optional(Schema.String),
    pluginId: Schema.optional(Schema.String),
    outcome: Schema.Literals(["complete", "failed", "pending", "requeued"]),
    errorCode: Schema.optional(Schema.String),
    detail: Schema.optional(Schema.String),
    httpStatus: Schema.optional(Schema.Number),
    nodeCount: Schema.optional(Schema.Number),
    durationMs: Schema.optional(Schema.Number),
    attempt: Schema.optional(Schema.Number),
  })

export const linkMetadataSchema: Schema.Codec<LinkMetadata> = Schema.Struct({
  schemaVersion: Schema.Literal(3),
  source: Schema.Record(Schema.String, Schema.Json),
  extraction: Schema.Struct({
    extractedLinks: Schema.mutable(Schema.Array(extractedLinkSchema)),
    extractedAt: Schema.optional(Schema.Number),
  }),
  playback: Schema.Struct({
    openedUrls: Schema.mutable(Schema.Array(Schema.String)),
    resolvedMirrors: Schema.optional(
      Schema.Record(
        Schema.String,
        Schema.mutable(Schema.Array(extractedLinkSchema))
      )
    ),
  }),
  debugLog: Schema.optional(
    Schema.mutable(Schema.Array(linkDebugLogEntrySchema))
  ),
  artwork: Schema.optional(
    Schema.Struct({
      providerId: Schema.Number,
      title: Schema.String,
      year: Schema.optional(Schema.Number),
      /** TMDB movie and tv ids are separate namespaces; by-id lookups
          need the kind to pick the right details endpoint. */
      mediaKind: Schema.optional(Schema.Literals(["movie", "tv"])),
    })
  ),
})

export const parseCanonicalLinkMetadataJson = (metadataJson: string) =>
  Schema.decodeUnknownSync(linkMetadataSchema)(JSON.parse(metadataJson))

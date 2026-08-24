import { Result, Schema } from "effect"
import {
  DATA_VERSION_RESPONSE_HEADER,
  TITLE_GROUPS_API_TIMEOUT_MS,
} from "~/lib/constants"
import { extractedLinkSchema } from "~/features/links/storage-schemas"

const mediaStateSchema = Schema.Literals([
  "pending",
  "available",
  "unavailable",
  "failed",
])

const sourceVariantSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  savedLinkId: Schema.String,
  occurrenceKey: Schema.String,
  nodeKey: Schema.String,
  nodePath: Schema.String,
  label: Schema.String,
  sourceName: Schema.String,
  quality: Schema.optional(Schema.String),
  size: Schema.optional(Schema.String),
  status: Schema.optional(Schema.Literals(["up", "down"])),
  mediaNodeKind: Schema.optional(
    Schema.Literals(["group", "resolvable", "playable"])
  ),
  resolutionKind: Schema.optional(Schema.Literals(["folder", "mirrors"])),
  target: Schema.optional(Schema.String),
  node: extractedLinkSchema,
  timestamp: Schema.Number,
})

const titleEntrySchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  entryKey: Schema.String,
  kind: Schema.Literals([
    "movie",
    "episode",
    "episode-range",
    "container",
    "unknown",
  ]),
  seasonNumber: Schema.optional(Schema.Number),
  episodeStart: Schema.optional(Schema.Number),
  episodeEnd: Schema.optional(Schema.Number),
  displayLabel: Schema.String,
  metadataState: mediaStateSchema,
  stillPath: Schema.optional(Schema.String),
  sources: Schema.Array(sourceVariantSchema),
})

const titleGroupSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  identityKey: Schema.String,
  mediaKind: Schema.Literals(["movie", "tv-season", "unmatched"]),
  displayTitle: Schema.String,
  year: Schema.optional(Schema.Number),
  seasonNumber: Schema.optional(Schema.Number),
  metadataState: mediaStateSchema,
  provider: Schema.optional(Schema.String),
  metadataFetchedAt: Schema.optional(Schema.Number),
  metadataExpiresAt: Schema.optional(Schema.Number),
  posterPath: Schema.optional(Schema.String),
  backdropPath: Schema.optional(Schema.String),
  overview: Schema.optional(Schema.String),
  lastAddedAt: Schema.Number,
  sourceCount: Schema.Number,
  entries: Schema.Array(titleEntrySchema),
})

const titleProjectionSchema = Schema.Struct({
  dateGroups: Schema.Array(
    Schema.Struct({
      key: Schema.String,
      label: Schema.String,
      groups: Schema.Array(titleGroupSchema),
    })
  ),
  unmatchedGroups: Schema.Array(titleGroupSchema),
})

const titleGroupsResponseSchema = Schema.Struct({
  dateGroups: titleProjectionSchema.fields.dateGroups,
  unmatchedGroups: titleProjectionSchema.fields.unmatchedGroups,
  dataVersion: Schema.optional(Schema.Number),
})

export interface TitleGroupsResponse {
  readonly projection: TitleProjection
  readonly dataVersion: number
}

const readTitleGroupsResponse = async (
  httpResponse: Response
): Promise<TitleGroupsResponse> => {
  const parsed = Schema.decodeUnknownResult(titleGroupsResponseSchema)(
    await httpResponse.json()
  )
  if (Result.isFailure(parsed)) {
    throw new Error("Media library response was invalid")
  }
  return {
    projection: {
      dateGroups: parsed.success.dateGroups,
      unmatchedGroups: parsed.success.unmatchedGroups,
    },
    dataVersion: Number(
      httpResponse.headers.get(DATA_VERSION_RESPONSE_HEADER) ??
        parsed.success.dataVersion ??
        0
    ),
  }
}

export const titleGroupsDataApi = {
  list: async (): Promise<TitleGroupsResponse> => {
    const response = await fetch("/api/data/title-groups", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout?.(TITLE_GROUPS_API_TIMEOUT_MS),
    })
    if (!response.ok) {
      throw new Error("Unable to load the media library")
    }
    return readTitleGroupsResponse(response)
  },
}

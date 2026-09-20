import { Schema } from "effect"

const SavedLinkApiRecordSchema = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
  title: Schema.NullOr(Schema.String),
  metaJson: Schema.String,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  extractionState: Schema.optional(
    Schema.Literals(["queued", "running", "complete", "failed"])
  ),
  extractionError: Schema.optional(Schema.NullOr(Schema.String)),
})

export const SavedLinkListResponseSchema = Schema.Struct({
  links: Schema.Array(SavedLinkApiRecordSchema),
})

export type SavedLinkApiRecord = typeof SavedLinkApiRecordSchema.Type
type SavedLinkListResponseBody = typeof SavedLinkListResponseSchema.Type
export type SavedLinkListResponse = SavedLinkListResponseBody & {
  readonly dataVersion: number
}

const MediaArtworkKindSchema = Schema.Literals(["movie", "tv"])

const MediaArtworkIdentitySchema = Schema.Struct({
  providerId: Schema.Number,
  title: Schema.String,
  year: Schema.optional(Schema.Number),
  // Picks the provider namespace for by-id lookups.
  mediaKind: Schema.optional(MediaArtworkKindSchema),
})

const MediaArtworkCandidateSchema = Schema.Struct({
  providerId: Schema.Number,
  title: Schema.String,
  year: Schema.optional(Schema.Number),
  mediaKind: Schema.optional(MediaArtworkKindSchema),
  posterPath: Schema.optional(Schema.String),
})

export const MediaArtworkRequestSchema = Schema.Struct({
  title: Schema.NonEmptyString,
  mediaKind: Schema.optional(MediaArtworkKindSchema),
  year: Schema.optional(Schema.Number),
  seasonNumber: Schema.optional(Schema.Number),
  episodeNumber: Schema.optional(Schema.Number),
  // When set, artwork resolves by immutable id; title matching is skipped.
  providerId: Schema.optional(Schema.Number),
})

const MediaArtworkResultSchema = Schema.Struct({
  posterPath: Schema.optional(Schema.String),
  stillPath: Schema.optional(Schema.String),
  episodeTitle: Schema.optional(Schema.String),
  identity: Schema.optional(MediaArtworkIdentitySchema),
  candidates: Schema.optional(Schema.Array(MediaArtworkCandidateSchema)),
  // Transient provider failure; callers must not negative-cache it.
  failed: Schema.optional(Schema.Boolean),
})

export const MediaArtworkResponseSchema = Schema.Struct({
  results: Schema.Array(MediaArtworkResultSchema),
})

export type MediaArtworkIdentity = typeof MediaArtworkIdentitySchema.Type
export type MediaArtworkCandidate = typeof MediaArtworkCandidateSchema.Type

/** The optional provider id selects an immutable artwork identity. */
export type MediaArtworkRequest = typeof MediaArtworkRequestSchema.Type

/** Failed provider attempts must not be negative-cached by callers. */
export type MediaArtworkResult = typeof MediaArtworkResultSchema.Type
export type MediaArtworkResponse = typeof MediaArtworkResponseSchema.Type

export const canonicalizeMediaArtworkTitle = (title: string): string =>
  title.normalize("NFKC").trim().toLowerCase()

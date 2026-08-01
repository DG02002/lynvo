import { z } from "zod"
import type { ExtractedLink, LinkMetadata, MetaData } from "./types"

export const extractedLinkSchema: z.ZodType<ExtractedLink> = z.lazy(() =>
  z.object({
    url: z.string().min(1),
    label: z.string(),
    id: z.string().optional(),
    badge: z.string().optional(),
    type: z.enum(["file", "folder"]).optional(),
    children: z.array(extractedLinkSchema).optional(),
    childrenResolved: z.boolean().optional(),
    rangeRequest: z.enum(["supported", "unsupported", "unknown"]).optional(),
    expiry: z.number().optional(),
    status: z.enum(["up", "down"]).optional(),
    watched: z.boolean().optional(),
    size: z.string().optional(),
    sourceName: z.string().optional(),
    selectable: z.boolean().optional(),
    mediaNodeKind: z.enum(["group", "resolvable", "playable"]).optional(),
    resolutionKind: z.enum(["folder", "mirrors"]).optional(),
  })
)

export const metadataSchema: z.ZodType<MetaData> = z.object({
  filename: z.string().optional(),
  contentType: z.string().optional(),
  contentLength: z.number().optional(),
  lastModified: z.string().optional(),
  acceptRanges: z.string().optional(),
  rangeRequest: z.enum(["supported", "unsupported", "unknown"]).optional(),
  pluginName: z.string().optional(),
  pluginIcon: z.string().optional(),
  pluginId: z.string().optional(),
  sourceName: z.string().optional(),
  sourceIconUrl: z.string().optional(),
  sourceStatus: z
    .enum(["active", "maintenance", "degraded", "down"])
    .optional(),
  sourceVersion: z.string().optional(),
  sourceCredentialKind: z.enum(["domain-password", "http-basic"]).optional(),
  routeSourceName: z.string().optional(),
  routeSourceIconUrl: z.string().optional(),
  extractedLinks: z.array(extractedLinkSchema).optional(),
  audio: z.string().optional(),
  pageTitle: z.string().optional(),
  title: z.string().optional(),
  badge: z.string().optional(),
  schemaVersion: z.number().optional(),
  pluginServerId: z.string().optional(),
})

export const draftSchema = z.strictObject({
  links: z.array(extractedLinkSchema),
  meta: metadataSchema,
  originalUrl: z.string().min(1),
  expiresAt: z.number(),
})

export const draftsSchema = z.record(z.string(), draftSchema)

export type StoredDraft = z.infer<typeof draftSchema>

const linkMetadataSchema: z.ZodType<LinkMetadata> = z.object({
  schemaVersion: z.literal(3),
  source: z.record(z.string(), z.unknown()),
  extraction: z.object({
    extractedLinks: z.array(extractedLinkSchema),
    extractedAt: z.number().optional(),
  }),
  playback: z.object({
    watchedUrls: z.array(z.string()),
    watchedIds: z.array(z.string()),
    resolvedMirrors: z
      .record(z.string(), z.array(extractedLinkSchema))
      .optional(),
    newPlayableItemUrls: z.array(z.string()).optional(),
  }),
})

export const linksCacheEnvelopeSchema = z.object({
  results: z.array(z.unknown()),
  version: z.number().optional().default(0),
  etag: z.string().optional().default(""),
})

export const storedSavedLinkSchema = z.strictObject({
  id: z.string(),
  url: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  metadata: linkMetadataSchema,
  title: z.string().optional(),
})

export const storedRecentLinkSchema = z.looseObject({
  url: z.string().min(1),
  timestamp: z.number(),
  metadata: linkMetadataSchema,
})

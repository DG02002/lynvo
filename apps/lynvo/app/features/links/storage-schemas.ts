import { z } from "zod"
import type { ExtractedLink, LinkMetadata, MetaData } from "./types"

export const extractedLinkSchema: z.ZodType<ExtractedLink> = z.lazy(() =>
  z
    .object({
      nodeKey: z.string().min(1),
      url: z.string().min(1).optional(),
      nodeUrl: z.string().min(1).optional(),
      resourceId: z.string().min(1).optional(),
      label: z.string(),
      id: z.string().optional(),
      badge: z.string().optional(),
      type: z.enum(["file", "folder"]).optional(),
      children: z.array(extractedLinkSchema).optional(),
      childrenResolved: z.boolean().optional(),
      rangeRequest: z.enum(["supported", "unsupported", "unknown"]).optional(),
      expiry: z.number().optional(),
      expirySource: z
        .enum(["signed-url", "expires-header", "cache-control"])
        .optional(),
      status: z.enum(["up", "down"]).optional(),
      opened: z.boolean().optional(),
      size: z.string().optional(),
      sourceName: z.string().optional(),
      selectable: z.boolean().optional(),
      mediaNodeKind: z.enum(["group", "resolvable", "playable"]),
      resolutionKind: z.enum(["folder", "mirrors"]).optional(),
    })
    .superRefine((link, context) => {
      if (link.mediaNodeKind === "playable" && !link.url) {
        context.addIssue({
          code: "custom",
          message: "Playable nodes require a URL",
        })
      }
      if (link.mediaNodeKind === "playable" && link.type !== "file") {
        context.addIssue({
          code: "custom",
          message: "Playable nodes require the file type",
        })
      }
      if (
        link.mediaNodeKind === "resolvable" &&
        !link.nodeUrl &&
        !link.resourceId
      ) {
        context.addIssue({
          code: "custom",
          message: "Resolvable nodes require a node URL or resource identifier",
        })
      }
      if (link.mediaNodeKind === "group" && link.url) {
        context.addIssue({
          code: "custom",
          message: "Group nodes cannot have a URL",
        })
      }
      if (link.mediaNodeKind !== "playable" && link.type !== "folder") {
        context.addIssue({
          code: "custom",
          message: "Container nodes require the folder type",
        })
      }
      if (
        link.mediaNodeKind !== "resolvable" &&
        (link.nodeUrl || link.resourceId)
      ) {
        context.addIssue({
          code: "custom",
          message: "Only resolvable nodes can have resolution targets",
        })
      }
    })
)

export const metadataSchema: z.ZodType<MetaData> = z.object({
  filename: z.string().optional(),
  contentType: z.string().optional(),
  contentLength: z.number().optional(),
  lastModified: z.string().optional(),
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
  audio: z.string().optional(),
  pageTitle: z.string().optional(),
  title: z.string().optional(),
  badge: z.string().optional(),
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

export const linkMetadataSchema: z.ZodType<LinkMetadata> = z.strictObject({
  schemaVersion: z.literal(3),
  source: z.record(z.string(), z.unknown()),
  extraction: z.strictObject({
    extractedLinks: z.array(extractedLinkSchema),
    extractedAt: z.number().optional(),
  }),
  playback: z.strictObject({
    openedUrls: z.array(z.string()),
    openedIds: z.array(z.string()),
    resolvedMirrors: z
      .record(z.string(), z.array(extractedLinkSchema))
      .optional(),
  }),
})

export const linksCacheEnvelopeSchema = z.object({
  results: z.array(z.unknown()),
  revision: z.number().int().nonnegative(),
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

export const parseCanonicalLinkMetadataJson = (metadataJson: string) =>
  linkMetadataSchema.parse(JSON.parse(metadataJson))

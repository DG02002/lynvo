import { z } from "zod"
import { ERROR_CODES } from "./models.js"
import type {
  GroupNode,
  MediaNode,
  PlayableNode,
  ResolvableNode,
} from "./models.js"

export const pluginServerMatcherSchema = z.object({
  hosts: z.array(z.string()).min(1),
  hostPatterns: z.array(z.string()).optional(),
  pathPatterns: z.array(z.string()).optional(),
  schemes: z.array(z.string()).optional().default(["https"]),
})

const iconUrlSchema = z.url().refine((value) => {
  const url = new URL(value)
  return (
    url.protocol === "https:" ||
    (url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname))
  )
}, "Icon URLs must use HTTPS, except on loopback development hosts")

export const pluginServerManifestSchema = z.object({
  protocolVersion: z.literal("1.0"),
  pluginServerId: z.string().min(1),
  displayName: z.string().min(1),
  hasIcon: z.boolean().optional(),
  iconUrl: iconUrlSchema.optional(),
  homepage: z.url().startsWith("https://").optional(),
  auth: z.object({
    type: z.literal("bearer"),
  }),
  usage: z
    .object({
      endpoint: z.literal("/usage"),
    })
    .optional()
    .default({ endpoint: "/usage" }),
  matchers: z.array(pluginServerMatcherSchema).min(1),
  features: z.object({
    password: z.boolean().optional().default(false),
    lazyNodes: z.boolean().optional().default(false),
    basicAuth: z.boolean().optional().default(false),
    discovery: z.boolean().optional().default(false),
  }),
  extensions: z.record(z.string(), z.looseObject({})).optional().default({}),
})

export const usageMetricSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  used: z.number().nonnegative().finite(),
  limit: z.number().positive().finite(),
  unit: z.string().min(1),
  period: z.enum(["daily", "monthly"]),
  resetsAt: z.iso.datetime(),
  pluginId: z.string().min(1).optional(),
})

export const usageResponseSchema = z.object({
  metrics: z.array(usageMetricSchema).min(1),
})

export const verifySuccessSchema = z.object({
  ok: z.literal(true),
})

export const verifyErrorSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

export const discoverRequestSchema = z.object({
  url: z.url(),
  basicAuth: z
    .object({
      username: z.string(),
      password: z.string(),
    })
    .optional(),
})

export const discoverResponseSchema = z.discriminatedUnion("matched", [
  z.object({ matched: z.literal(false) }),
  z.object({
    matched: z.literal(true),
    pluginId: z.string().min(1),
    confidence: z.enum(["pattern", "verified"]),
  }),
])

export const pluginMetadataSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().min(1).optional(),
  homepage: z.url().startsWith("https://").optional(),
  hasIcon: z.boolean().optional(),
  iconUrl: iconUrlSchema.optional(),
  status: z.enum(["active", "maintenance", "degraded", "down"]).optional(),
  version: z.string().optional(),
  routesToPluginId: z.string().min(1).optional(),
  matchStrategy: z.enum(["static", "probe"]).optional().default("static"),
  hosts: z.array(z.string()).default([]),
  matchers: z.array(pluginServerMatcherSchema).optional(),
  credential: z
    .object({
      kind: z.enum(["domain-password", "http-basic"]),
      scope: z.literal("domain"),
      required: z.boolean(),
    })
    .optional(),
})

export const lynvoPluginCatalogSchema = z.object({
  plugins: z.array(pluginMetadataSchema).optional().default([]),
})

const baseNodeFields = {
  id: z.string().optional(),
  label: z.string(),
  badge: z.string().optional(),
  size: z.string().optional(),
  sourceName: z.string().optional(),
}

export const mediaNodeSchema: z.ZodType<MediaNode> = z.lazy(() =>
  z.union([groupNodeSchema, resolvableNodeSchema, playableNodeSchema])
)

export const groupNodeSchema: z.ZodType<GroupNode> = z.object({
  ...baseNodeFields,
  kind: z.literal("group"),
  selectable: z.boolean().optional().default(false),
  children: mediaNodeSchema.array(),
})

export const resolvableNodeSchema: z.ZodType<ResolvableNode> = z.object({
  ...baseNodeFields,
  kind: z.literal("resolvable"),
  nodeUrl: z.string().optional(),
  resourceId: z.string().optional(),
  resolutionKind: z.enum(["folder", "mirrors"]).optional(),
})

export const playableNodeSchema: z.ZodType<PlayableNode> = z.object({
  ...baseNodeFields,
  kind: z.literal("playable"),
  url: z.string(),
  expiry: z.number().optional(),
  expirySource: z
    .enum(["signed-url", "expires-header", "cache-control"])
    .optional(),
  status: z.enum(["up", "down", "unknown"]).optional(),
  rangeRequest: z.enum(["supported", "unsupported", "unknown"]).optional(),
})

export const extractSuccessSchema = z.object({
  plugin: z.object({
    pluginServerId: z.string(),
    displayName: z.string(),
    iconUrl: iconUrlSchema.optional(),
    pluginId: z.string().optional(),
    pluginName: z.string().optional(),
    pluginIconUrl: iconUrlSchema.optional(),
    pageTitle: z.string().optional(),
    audio: z.string().optional(),
  }),
  nodes: z.array(mediaNodeSchema),
  extensions: z.record(z.string(), z.looseObject({})).optional().default({}),
})

export const extractErrorSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    retryAfterSeconds: z.number().optional(),
  }),
  extensions: z.record(z.string(), z.looseObject({})).optional().default({}),
})

export const sourceInputSchema = z.object({
  kind: z.literal("source"),
  sourceUrl: z.string(),
})

export const nodeInputSchema = z.object({
  kind: z.literal("node"),
  nodeUrl: z.string(),
  resourceId: z.string().optional(),
})

export const extractRequestSchema = z.object({
  input: z.discriminatedUnion("kind", [sourceInputSchema, nodeInputSchema]),
  pluginId: z.string().min(1).optional(),
  password: z.string().optional(),
  basicAuth: z
    .object({
      username: z.string(),
      password: z.string(),
    })
    .optional(),
})

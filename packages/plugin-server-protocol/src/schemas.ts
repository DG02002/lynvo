import { Effect, Schema } from "effect"
import {
  ERROR_CODES,
  isCompatibleProtocolVersion,
  PROTOCOL_VERSION,
  type GroupNode,
  type MediaNode,
  type PlayableNode,
  type ResolvableNode,
} from "./models.js"

export const pluginServerMatcherSchema = Schema.Struct({
  hosts: Schema.NonEmptyArray(Schema.String),
  hostPatterns: Schema.optional(Schema.Array(Schema.String)),
  pathPatterns: Schema.optional(Schema.Array(Schema.String)),
  schemes: Schema.Array(Schema.String).pipe(
    Schema.withDecodingDefault(Effect.succeed(["https"]))
  ),
})

const iconUrlSchema = Schema.String.pipe(
  Schema.refine(
    (value): value is string => {
      try {
        const url = new URL(value)
        return (
          url.protocol === "https:" ||
          (url.protocol === "http:" &&
            ["localhost", "127.0.0.1", "::1"].includes(url.hostname))
        )
      } catch {
        return false
      }
    },
    {
      message: "Icon URLs must use HTTPS, except on loopback development hosts",
    }
  )
)

const httpsUrlSchema = Schema.String.pipe(
  Schema.refine(
    (value): value is string => {
      try {
        const url = new URL(value)
        return url.protocol === "https:"
      } catch {
        return false
      }
    },
    { message: "Must be a valid HTTPS URL" }
  )
)

const urlStringSchema = Schema.String.pipe(
  Schema.refine(
    (value): value is string => {
      try {
        new URL(value)
        return true
      } catch {
        return false
      }
    },
    { message: "Must be a valid URL" }
  )
)

// Minor wire versions are additive by contract, so any 1.x manifest whose
// major matches the current protocol major is accepted; a major mismatch is
// the only wire-level break.
const protocolVersionSchema = Schema.String.pipe(
  Schema.refine(
    (value): value is string => isCompatibleProtocolVersion(value),
    {
      message: `protocolVersion must be a ${PROTOCOL_VERSION.split(".")[0]}.x version`,
    }
  )
)

export const pluginServerManifestSchema = Schema.Struct({
  protocolVersion: protocolVersionSchema,
  pluginServerId: Schema.NonEmptyString,
  displayName: Schema.NonEmptyString,
  hasIcon: Schema.optional(Schema.Boolean),
  iconUrl: Schema.optional(iconUrlSchema),
  homepage: Schema.optional(httpsUrlSchema),
  auth: Schema.Struct({
    type: Schema.Literal("bearer"),
  }),
  usage: Schema.Struct({
    endpoint: Schema.Literal("/usage"),
  }).pipe(
    Schema.withDecodingDefault(Effect.succeed({ endpoint: "/usage" as const }))
  ),
  matchers: Schema.NonEmptyArray(pluginServerMatcherSchema),
  features: Schema.Struct({
    password: Schema.Boolean.pipe(
      Schema.withDecodingDefault(Effect.succeed(false))
    ),
    lazyNodes: Schema.Boolean.pipe(
      Schema.withDecodingDefault(Effect.succeed(false))
    ),
    basicAuth: Schema.Boolean.pipe(
      Schema.withDecodingDefault(Effect.succeed(false))
    ),
    discovery: Schema.Boolean.pipe(
      Schema.withDecodingDefault(Effect.succeed(false))
    ),
  }),
  extensions: Schema.Record(Schema.String, Schema.Unknown).pipe(
    Schema.withDecodingDefault(Effect.succeed({}))
  ),
})

const isoTimestampSchema = Schema.String.pipe(
  Schema.refine((value): value is string => !Number.isNaN(Date.parse(value)), {
    message: "Must be an ISO 8601 timestamp",
  })
)

export const usageMetricSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  label: Schema.NonEmptyString,
  used: Schema.Number.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  limit: Schema.Number.pipe(Schema.check(Schema.isGreaterThan(0))),
  unit: Schema.NonEmptyString,
  period: Schema.Literals(["daily", "monthly"]),
  resetsAt: isoTimestampSchema,
  pluginId: Schema.optional(Schema.NonEmptyString),
})

export const usageResponseSchema = Schema.Struct({
  metrics: Schema.NonEmptyArray(usageMetricSchema),
})

export const verifySuccessSchema = Schema.Struct({
  ok: Schema.Literal(true),
})

export const verifyErrorSchema = Schema.Struct({
  ok: Schema.Literal(false),
  error: Schema.Struct({
    code: Schema.String,
    message: Schema.String,
  }),
})

export const discoverRequestSchema = Schema.Struct({
  url: urlStringSchema,
  basicAuth: Schema.optional(
    Schema.Struct({
      username: Schema.String,
      password: Schema.String,
    })
  ),
})

export const discoverResponseSchema = Schema.Union([
  Schema.Struct({ matched: Schema.Literal(false) }),
  Schema.Struct({
    matched: Schema.Literal(true),
    pluginId: Schema.NonEmptyString,
    confidence: Schema.Literals(["pattern", "verified"]),
  }),
])

export const pluginMetadataSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  displayName: Schema.NonEmptyString,
  description: Schema.optional(Schema.NonEmptyString),
  homepage: Schema.optional(httpsUrlSchema),
  hasIcon: Schema.optional(Schema.Boolean),
  iconUrl: Schema.optional(iconUrlSchema),
  status: Schema.optional(
    Schema.Literals(["active", "maintenance", "degraded", "down"])
  ),
  version: Schema.optional(Schema.String),
  routesToPluginId: Schema.optional(Schema.NonEmptyString),
  matchStrategy: Schema.optional(Schema.Literals(["static", "probe"])),
  usageMultiplier: Schema.optional(
    Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(1)))
  ),
  proxyCreditUsage: Schema.optional(Schema.NonEmptyString),
  hosts: Schema.Array(Schema.String).pipe(
    Schema.withDecodingDefault(Effect.succeed([]))
  ),
  matchers: Schema.optional(Schema.Array(pluginServerMatcherSchema)),
  credential: Schema.optional(
    Schema.Struct({
      kind: Schema.Literals(["domain-password", "http-basic"]),
      scope: Schema.Literal("domain"),
      required: Schema.Boolean,
    })
  ),
})

export const lynvoPluginCatalogSchema = Schema.Struct({
  plugins: Schema.Array(pluginMetadataSchema).pipe(
    Schema.withDecodingDefault(Effect.succeed([]))
  ),
  proxyProvider: Schema.optional(Schema.Literal("scrape-do")),
})

const baseNodeFields = {
  id: Schema.optional(Schema.String),
  label: Schema.String,
  badge: Schema.optional(Schema.String),
  size: Schema.optional(Schema.String),
  sourceName: Schema.optional(Schema.String),
  extensions: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
}

export const groupNodeSchema: Schema.Codec<GroupNode> = Schema.Struct({
  ...baseNodeFields,
  kind: Schema.Literal("group"),
  selectable: Schema.Boolean.pipe(
    Schema.withDecodingDefault(Effect.succeed(false))
  ),
  children: Schema.Array(
    Schema.suspend((): Schema.Codec<MediaNode> => mediaNodeSchema)
  ),
})

export const resolvableNodeSchema: Schema.Codec<ResolvableNode> = Schema.Struct(
  {
    ...baseNodeFields,
    kind: Schema.Literal("resolvable"),
    nodeUrl: Schema.optional(Schema.String),
    resourceId: Schema.optional(Schema.String),
    resolutionKind: Schema.optional(Schema.Literals(["folder", "mirrors"])),
  }
)

export const playableNodeSchema: Schema.Codec<PlayableNode> = Schema.Struct({
  ...baseNodeFields,
  kind: Schema.Literal("playable"),
  url: Schema.String,
  expiry: Schema.optional(Schema.Number),
  expirySource: Schema.optional(
    Schema.Literals(["signed-url", "expires-header", "cache-control"])
  ),
  status: Schema.optional(Schema.Literals(["up", "down", "unknown"])),
  rangeRequest: Schema.optional(
    Schema.Literals(["supported", "unsupported", "unknown"])
  ),
})

export const mediaNodeSchema: Schema.Codec<MediaNode> = Schema.Union([
  groupNodeSchema,
  resolvableNodeSchema,
  playableNodeSchema,
])

export const extractPendingSchema = Schema.Struct({
  retryAfterSeconds: Schema.Number.pipe(Schema.check(Schema.isGreaterThan(0))),
  resumeNodeId: Schema.optional(Schema.NonEmptyString),
})

export const extractUsageDeltaSchema = Schema.Array(
  Schema.Struct({
    id: Schema.NonEmptyString,
    used: Schema.Number.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
    unit: Schema.optional(Schema.String),
  })
)

export const extractSuccessSchema = Schema.Struct({
  plugin: Schema.Struct({
    pluginServerId: Schema.String,
    displayName: Schema.String,
    iconUrl: Schema.optional(iconUrlSchema),
    pluginId: Schema.optional(Schema.String),
    pluginName: Schema.optional(Schema.String),
    pluginIconUrl: Schema.optional(iconUrlSchema),
    pageTitle: Schema.optional(Schema.String),
    audio: Schema.optional(Schema.String),
  }),
  nodes: Schema.Array(mediaNodeSchema),
  extensions: Schema.Record(Schema.String, Schema.Unknown).pipe(
    Schema.withDecodingDefault(Effect.succeed({}))
  ),
  pending: Schema.optional(extractPendingSchema),
  usageDelta: Schema.optional(extractUsageDeltaSchema),
})

export const extractErrorSchema = Schema.Struct({
  ok: Schema.Literal(false),
  error: Schema.Struct({
    code: Schema.Literals(ERROR_CODES),
    message: Schema.String,
    retryAfterSeconds: Schema.optional(Schema.Number),
  }),
  extensions: Schema.Record(Schema.String, Schema.Unknown).pipe(
    Schema.withDecodingDefault(Effect.succeed({}))
  ),
})

export const sourceInputSchema = Schema.Struct({
  kind: Schema.Literal("source"),
  sourceUrl: Schema.String,
})

export const nodeInputSchema = Schema.Struct({
  kind: Schema.Literal("node"),
  nodeUrl: Schema.String,
  resourceId: Schema.optional(Schema.String),
})

export const extractRequestSchema = Schema.Struct({
  input: Schema.Union([sourceInputSchema, nodeInputSchema]),
  pluginId: Schema.optional(Schema.NonEmptyString),
  password: Schema.optional(Schema.String),
  basicAuth: Schema.optional(
    Schema.Struct({
      username: Schema.String,
      password: Schema.String,
    })
  ),
  proxy: Schema.optional(
    Schema.Struct({
      provider: Schema.Literal("scrape-do"),
      token: Schema.NonEmptyString,
    })
  ),
})

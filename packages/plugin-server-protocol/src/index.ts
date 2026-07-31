import { z } from "zod"

export interface PluginServerMatcher {
  hosts: string[]
  hostPatterns?: string[]
  pathPatterns?: string[]
  schemes?: string[]
}

export interface PluginServerManifest {
  protocolVersion: "1.0"
  pluginServerId: string
  displayName: string
  hasIcon?: boolean
  iconUrl?: string
  homepage?: string
  auth: {
    type: "bearer"
  }
  usage: {
    endpoint: "/usage"
  }
  matchers: PluginServerMatcher[]
  features: {
    password: boolean
    lazyNodes: boolean
    basicAuth?: boolean
    discovery?: boolean
  }
  extensions: Record<string, unknown>
}

export interface UsageMetric {
  id: string
  label: string
  used: number
  limit: number
  unit: string
  period: "daily" | "monthly"
  resetsAt: string
  pluginId?: string
}

export interface UsageResponse {
  metrics: UsageMetric[]
}

export interface GroupNode {
  kind: "group"
  id?: string
  label: string
  badge?: string
  size?: string
  sourceName?: string
  selectable?: boolean
  children: MediaNode[]
}

export interface ResolvableNode {
  kind: "resolvable"
  id?: string
  label: string
  nodeUrl?: string
  resourceId?: string
  resolutionKind?: "folder" | "mirrors"
  badge?: string
  size?: string
  sourceName?: string
}

export interface PlayableNode {
  kind: "playable"
  id?: string
  label: string
  url: string
  badge?: string
  size?: string
  sourceName?: string
  expiry?: number
  status?: "up" | "down" | "unknown"
}

export type MediaNode = GroupNode | ResolvableNode | PlayableNode

export interface SourceInput {
  kind: "source"
  sourceUrl: string
}

export interface NodeInput {
  kind: "node"
  nodeUrl: string
  resourceId?: string
}

export interface ExtractRequest {
  input: SourceInput | NodeInput
  pluginId?: string
  password?: string
  basicAuth?: HttpBasicAuth
}

export interface HttpBasicAuth {
  username: string
  password: string
}

export interface ExtractedHttpBasicAuth {
  basicAuth?: HttpBasicAuth
  url: string
}

export interface ExtractSuccessResponse {
  plugin: {
    pluginServerId: string
    displayName: string
    iconUrl?: string
    pluginId?: string
    pluginName?: string
    pluginIconUrl?: string
    pageTitle?: string
    audio?: string
  }
  nodes: MediaNode[]
  extensions: Record<string, unknown>
}

export interface ExtractProtocolError {
  ok: false
  error: {
    code: ErrorCode
    message: string
    retryAfterSeconds?: number
  }
  extensions: Record<string, unknown>
}

export interface VerifySuccessResponse {
  ok: true
}

export interface VerifyErrorResponse {
  ok: false
  error: {
    code: string
    message: string
  }
}

export interface DiscoverRequest {
  url: string
  basicAuth?: HttpBasicAuth
}

export type DiscoverResponse =
  | { matched: false }
  | {
      matched: true
      pluginId: string
      confidence: "pattern" | "verified"
    }

export interface PluginMetadata {
  id: string
  displayName: string
  description?: string
  homepage?: string
  hasIcon?: boolean
  iconUrl?: string
  status?: "active" | "maintenance" | "degraded" | "down"
  version?: string
  routesToPluginId?: string
  hosts: string[]
  matchers?: PluginServerMatcher[]
  credential?: PluginCredential
}

export interface PluginCredential {
  kind: "domain-password" | "http-basic"
  scope: "domain"
  required: boolean
}

export interface LynvoManifestExtension {
  plugins?: PluginMetadata[]
}

export interface ContractIssue {
  path: string
  message: string
}

export interface ContractValidationResult {
  ok: boolean
  issues: ContractIssue[]
}

export interface PluginServerRuntimeContext<Env> {
  request: Request
  env: Env
}

export interface PluginServerRuntimeAuth<Env> {
  validate: (
    context: PluginServerRuntimeContext<Env>
  ) => Promise<boolean> | boolean
}

export interface PluginServerRuntimeExtractOptions<Env> {
  request: ExtractRequest
  targetUrl: string
  env: Env
}

export interface PluginServerRuntimeDiscoverOptions<Env> {
  request: DiscoverRequest
  targetUrl: string
  env: Env
}

export type PluginServerRuntimeManifest<Env> =
  | PluginServerManifest
  | ((
      context: PluginServerRuntimeContext<Env>
    ) => Promise<PluginServerManifest> | PluginServerManifest)

export interface PluginServerRuntimeOptions<Env> {
  manifest: PluginServerRuntimeManifest<Env>
  auth: PluginServerRuntimeAuth<Env>
  extract: (
    options: PluginServerRuntimeExtractOptions<Env>
  ) => Promise<ExtractSuccessResponse> | ExtractSuccessResponse
  discover?: (
    options: PluginServerRuntimeDiscoverOptions<Env>
  ) => Promise<DiscoverResponse> | DiscoverResponse
  usage: (
    context: PluginServerRuntimeContext<Env>
  ) => Promise<UsageResponse> | UsageResponse
  onError?: (error: unknown, context: PluginServerRuntimeContext<Env>) => void
}

export interface PluginServerRuntime<Env> {
  handleManifest: (request: Request, env: Env) => Promise<Response>
  handleVerify: (request: Request, env: Env) => Promise<Response>
  handleUsage: (request: Request, env: Env) => Promise<Response>
  handleDiscover: (request: Request, env: Env) => Promise<Response>
  handleExtract: (request: Request, env: Env) => Promise<Response>
}

export const ERROR_CODES = [
  "UNSUPPORTED_URL",
  "AUTH_INVALID",
  "AUTH_REQUIRED",
  "RATE_LIMITED",
  "TEMPORARY_FAILURE",
  "PERMANENT_FAILURE",
  "PASSWORD_REQUIRED",
  "INVALID_PASSWORD",
  "NODE_EXPIRED",
  "PROTOCOL_MISMATCH",
  "BAD_REQUEST",
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export const SUPPORTED_PROTOCOL_VERSIONS = ["1.0"] as const

export type SupportedProtocolVersion =
  (typeof SUPPORTED_PROTOCOL_VERSIONS)[number]

export const isSupportedProtocolVersion = (
  version: string
): version is SupportedProtocolVersion =>
  (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(version)

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
  extensions: z.record(z.string(), z.unknown()).optional().default({}),
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

export const groupNodeSchema = z.object({
  ...baseNodeFields,
  kind: z.literal("group"),
  selectable: z.boolean().optional().default(false),
  children: mediaNodeSchema.array(),
}) as z.ZodType<GroupNode>

export const resolvableNodeSchema = z.object({
  ...baseNodeFields,
  kind: z.literal("resolvable"),
  nodeUrl: z.string().optional(),
  resourceId: z.string().optional(),
  resolutionKind: z.enum(["folder", "mirrors"]).optional(),
}) as z.ZodType<ResolvableNode>

export const playableNodeSchema = z.object({
  ...baseNodeFields,
  kind: z.literal("playable"),
  url: z.string(),
  expiry: z.number().optional(),
  status: z.enum(["up", "down", "unknown"]).optional(),
}) as z.ZodType<PlayableNode>

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
  extensions: z.record(z.string(), z.unknown()).optional().default({}),
})

export const extractErrorSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    retryAfterSeconds: z.number().optional(),
  }),
  extensions: z.record(z.string(), z.unknown()).optional().default({}),
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

export const createProtocolError = (
  code: ErrorCode,
  message: string,
  retryAfterSeconds?: number
): ExtractProtocolError => ({
  ok: false,
  error: {
    code,
    message,
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  },
  extensions: {},
})

const jsonResponse = (value: unknown, status = 200): Response =>
  Response.json(value, { status })

export const createSourceExtractRequest = (
  sourceUrl: string,
  password?: string,
  basicAuth?: HttpBasicAuth,
  pluginId?: string
): ExtractRequest => ({
  input: {
    kind: "source",
    sourceUrl,
  },
  ...(pluginId ? { pluginId } : {}),
  ...(password ? { password } : {}),
  ...(basicAuth ? { basicAuth } : {}),
})

export const createNodeExtractRequest = (
  nodeUrl: string,
  password?: string,
  basicAuth?: HttpBasicAuth,
  pluginId?: string
): ExtractRequest => ({
  input: {
    kind: "node",
    nodeUrl,
  },
  ...(pluginId ? { pluginId } : {}),
  ...(password ? { password } : {}),
  ...(basicAuth ? { basicAuth } : {}),
})

export const extractHttpBasicAuth = (
  sourceUrl: string
): ExtractedHttpBasicAuth => {
  const url = new URL(sourceUrl)
  if (!url.username && !url.password) {
    return { url: url.toString() }
  }

  const basicAuth = {
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  }
  url.username = ""
  url.password = ""
  return { url: url.toString(), basicAuth }
}

export const applyHttpBasicAuth = (
  sourceUrl: string,
  basicAuth?: HttpBasicAuth
): string => {
  if (!basicAuth) {
    return sourceUrl
  }

  const url = new URL(sourceUrl)
  url.username = basicAuth.username
  url.password = basicAuth.password
  return url.toString()
}

export const isErrorCode = (code: string): code is ErrorCode =>
  (ERROR_CODES as readonly string[]).includes(code)

const patternToExpression = (
  pattern: string,
  segmentWildcard: string
): RegExp => {
  const expression = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "TEMP_DBL_STAR")
    .replace(/\*/g, segmentWildcard)
    .replace(/TEMP_DBL_STAR/g, ".*")
  return new RegExp(`^${expression}$`, "i")
}

export const matchPluginServerUrl = (
  targetUrl: string,
  matchers: readonly PluginServerMatcher[]
): boolean => {
  try {
    const parsed = new URL(targetUrl)
    const hostname = parsed.hostname.toLowerCase()
    const pathname = parsed.pathname
    const scheme = parsed.protocol.replace(":", "")

    for (const matcher of matchers) {
      const schemes = new Set(matcher.schemes ?? ["https"])
      if (!schemes.has(scheme)) {
        continue
      }

      const hosts = new Set(matcher.hosts.map((host) => host.toLowerCase()))
      let didHostMatch = hosts.has(hostname)

      if (!didHostMatch && matcher.hostPatterns) {
        didHostMatch = matcher.hostPatterns.some((pattern) =>
          patternToExpression(pattern, ".*").test(hostname)
        )
      }

      if (!didHostMatch) {
        continue
      }

      const pathPatterns = matcher.pathPatterns ?? ["/**"]
      const didPathMatch = pathPatterns.some((pattern) =>
        patternToExpression(pattern, "[^/]*").test(pathname)
      )

      if (didPathMatch) {
        return true
      }
    }
  } catch {
    return false
  }
  return false
}

export const getExtractTargetUrl = (request: ExtractRequest): string =>
  request.input.kind === "source"
    ? request.input.sourceUrl
    : request.input.nodeUrl

export const getLynvoManifestExtension = (
  manifest: PluginServerManifest
): LynvoManifestExtension => {
  const result = lynvoPluginCatalogSchema.safeParse(
    manifest.extensions["lynvo"]
  )
  return result.success ? result.data : { plugins: [] }
}

export const parseLynvoManifestExtension = (
  manifest: PluginServerManifest
): LynvoManifestExtension =>
  manifest.extensions["lynvo"] === undefined
    ? { plugins: [] }
    : lynvoPluginCatalogSchema.parse(manifest.extensions["lynvo"])

export const getMatchedPlugin = (
  manifest: PluginServerManifest,
  targetUrl: string
): PluginMetadata | undefined => {
  const extension = getLynvoManifestExtension(manifest)
  return extension.plugins?.find((source) => {
    if (source.matchers && matchPluginServerUrl(targetUrl, source.matchers)) {
      return true
    }

    let host: string
    try {
      host = new URL(targetUrl).hostname.toLowerCase()
    } catch {
      return false
    }

    return source.hosts.some((sourceHost) => sourceHost.toLowerCase() === host)
  })
}

const issue = (path: string, message: string): ContractIssue => ({
  path,
  message,
})

export const validatePluginServerManifestContract = (
  value: unknown
): ContractValidationResult => {
  const didDeclareUsage =
    typeof value === "object" && value !== null && "usage" in value
  const parsed = pluginServerManifestSchema.safeParse(value)
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((schemaIssue) =>
        issue(schemaIssue.path.join(".") || "manifest", schemaIssue.message)
      ),
    }
  }

  const manifest = parsed.data
  const issues: ContractIssue[] = []
  const pluginIds = new Set<string>()
  const extension = getLynvoManifestExtension(manifest)

  if (!didDeclareUsage) {
    issues.push(
      issue("usage", "Declare the mandatory authenticated /usage endpoint.")
    )
  }

  if (!manifest.pluginServerId.includes(".")) {
    issues.push(
      issue(
        "pluginServerId",
        "Use a stable namespaced id such as com.example.plugin-server to avoid collisions."
      )
    )
  }

  if (manifest.iconUrl && !manifest.iconUrl.endsWith(".webp")) {
    issues.push(
      issue("iconUrl", "Use a direct HTTPS WebP URL for Plugin Server icons.")
    )
  }
  if (manifest.hasIcon === true && !manifest.iconUrl) {
    issues.push(issue("iconUrl", "Provide iconUrl when hasIcon is true."))
  }
  if (manifest.hasIcon === false && manifest.iconUrl) {
    issues.push(
      issue("hasIcon", "Set hasIcon to true when iconUrl is present.")
    )
  }

  if (!extension.plugins || extension.plugins.length === 0) {
    issues.push(
      issue("extensions.lynvo.plugins", "Declare at least one Plugin.")
    )
  }

  extension.plugins?.forEach((source, index) => {
    const basePath = `extensions.lynvo.plugins.${index}`
    if (pluginIds.has(source.id)) {
      issues.push(issue(`${basePath}.id`, `Duplicate source id: ${source.id}`))
    }
    pluginIds.add(source.id)

    if (source.iconUrl && !source.iconUrl.endsWith(".webp")) {
      issues.push(issue(`${basePath}.iconUrl`, "Use a direct HTTPS WebP URL."))
    }
    if (source.hasIcon === true && !source.iconUrl) {
      issues.push(
        issue(`${basePath}.iconUrl`, "Provide iconUrl when hasIcon is true.")
      )
    }
    if (source.hasIcon === false && source.iconUrl) {
      issues.push(
        issue(
          `${basePath}.hasIcon`,
          "Set hasIcon to true when iconUrl is present."
        )
      )
    }
    if (!source.status) {
      issues.push(
        issue(
          `${basePath}.status`,
          "Declare active, maintenance, degraded, or down."
        )
      )
    }
    if (!source.version) {
      issues.push(issue(`${basePath}.version`, "Declare a Plugin version."))
    }
    if (
      source.hosts.length === 0 &&
      (!source.matchers || source.matchers.length === 0)
    ) {
      issues.push(
        issue(
          `${basePath}.matchers`,
          "Declare hosts or matchers for this source."
        )
      )
    }
  })

  return {
    ok: issues.length === 0,
    issues,
  }
}

export const validateExtractSuccessContract = (
  value: unknown
): ContractValidationResult => {
  const parsed = extractSuccessSchema.safeParse(value)
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((schemaIssue) =>
        issue(schemaIssue.path.join(".") || "extract", schemaIssue.message)
      ),
    }
  }

  const issues: ContractIssue[] = []
  const result = parsed.data

  if (result.plugin.iconUrl && !result.plugin.iconUrl.endsWith(".webp")) {
    issues.push(
      issue(
        "plugin.iconUrl",
        "Use a direct HTTPS WebP URL for Plugin Server icons."
      )
    )
  }

  if (
    result.plugin.pluginIconUrl &&
    !result.plugin.pluginIconUrl.endsWith(".webp")
  ) {
    issues.push(
      issue(
        "plugin.pluginIconUrl",
        "Use a direct HTTPS WebP URL for Plugin icons."
      )
    )
  }

  return {
    ok: issues.length === 0,
    issues,
  }
}

export const validateUsageContract = (
  value: unknown
): ContractValidationResult => {
  const parsed = usageResponseSchema.safeParse(value)
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((schemaIssue) =>
        issue(schemaIssue.path.join(".") || "usage", schemaIssue.message)
      ),
    }
  }

  const metricIds = new Set<string>()
  const issues: ContractIssue[] = []
  parsed.data.metrics.forEach((metric, index) => {
    if (metric.used > metric.limit) {
      issues.push(
        issue(`metrics.${index}.used`, "Usage cannot exceed its finite limit.")
      )
    }
    if (metricIds.has(metric.id)) {
      issues.push(
        issue(`metrics.${index}.id`, `Duplicate metric id: ${metric.id}`)
      )
    }
    metricIds.add(metric.id)
  })

  return { ok: issues.length === 0, issues }
}

export const createPluginServerRuntime = <Env>(
  options: PluginServerRuntimeOptions<Env>
): PluginServerRuntime<Env> => {
  const resolveManifest = async (
    request: Request,
    env: Env
  ): Promise<PluginServerManifest> => {
    const value =
      typeof options.manifest === "function"
        ? await options.manifest({ request, env })
        : options.manifest
    return pluginServerManifestSchema.parse(value)
  }

  const authenticate = async (
    request: Request,
    env: Env
  ): Promise<Response | undefined> => {
    const isAuthenticated = await options.auth.validate({ request, env })
    return isAuthenticated
      ? undefined
      : jsonResponse(
          createProtocolError("AUTH_INVALID", "API key was rejected."),
          401
        )
  }

  return {
    handleManifest: async (request, env) =>
      jsonResponse(await resolveManifest(request, env)),
    handleVerify: async (request, env) => {
      const authFailure = await authenticate(request, env)
      if (authFailure) {
        return authFailure
      }
      return jsonResponse({ ok: true } satisfies VerifySuccessResponse)
    },
    handleUsage: async (request, env) => {
      const authFailure = await authenticate(request, env)
      if (authFailure) {
        return authFailure
      }
      const usage = await options.usage({ request, env })
      const parsedUsage = usageResponseSchema.safeParse(usage)
      if (!parsedUsage.success) {
        return jsonResponse(
          createProtocolError(
            "PROTOCOL_MISMATCH",
            "Plugin Server returned invalid usage metrics."
          ),
          500
        )
      }
      return jsonResponse(parsedUsage.data)
    },
    handleDiscover: async (request, env) => {
      const authFailure = await authenticate(request, env)
      if (authFailure) {
        return authFailure
      }
      if (!options.discover) {
        return jsonResponse(
          createProtocolError(
            "UNSUPPORTED_URL",
            "This Plugin Server does not support source discovery."
          ),
          404
        )
      }

      let body: unknown
      try {
        body = await request.json()
      } catch {
        return jsonResponse(
          createProtocolError("BAD_REQUEST", "Invalid JSON body."),
          400
        )
      }
      const parsed = discoverRequestSchema.safeParse(body)
      if (!parsed.success) {
        return jsonResponse(
          createProtocolError("BAD_REQUEST", "Invalid discovery request."),
          400
        )
      }

      try {
        const result = await options.discover({
          request: parsed.data,
          targetUrl: parsed.data.url,
          env,
        })
        const parsedResult = discoverResponseSchema.safeParse(result)
        return parsedResult.success
          ? jsonResponse(parsedResult.data)
          : jsonResponse(
              createProtocolError(
                "PROTOCOL_MISMATCH",
                "Plugin Server returned an invalid discovery response."
              ),
              500
            )
      } catch (error) {
        options.onError?.(error, { request, env })
        return jsonResponse(
          createProtocolError("TEMPORARY_FAILURE", "Source discovery failed."),
          502
        )
      }
    },
    handleExtract: async (request, env) => {
      const authFailure = await authenticate(request, env)
      if (authFailure) {
        return authFailure
      }

      let body: unknown
      try {
        body = await request.json()
      } catch {
        return jsonResponse(
          createProtocolError("BAD_REQUEST", "Invalid JSON body."),
          400
        )
      }

      const parsed = extractRequestSchema.safeParse(body)
      if (!parsed.success) {
        return jsonResponse(
          createProtocolError("BAD_REQUEST", "Invalid request body."),
          400
        )
      }

      const targetUrl = getExtractTargetUrl(parsed.data)
      const manifest = await resolveManifest(request, env)
      if (!matchPluginServerUrl(targetUrl, manifest.matchers)) {
        return jsonResponse(
          createProtocolError(
            "UNSUPPORTED_URL",
            `Unsupported URL by this Plugin Server: ${targetUrl}`
          ),
          400
        )
      }

      try {
        const result = await options.extract({
          request: parsed.data,
          targetUrl,
          env,
        })
        const parsedResult = extractSuccessSchema.safeParse(result)
        if (!parsedResult.success) {
          return jsonResponse(
            createProtocolError(
              "PROTOCOL_MISMATCH",
              "Plugin Server returned an invalid response."
            ),
            500
          )
        }
        return jsonResponse(parsedResult.data)
      } catch (error) {
        options.onError?.(error, { request, env })
        const message = error instanceof Error ? error.message : String(error)
        if (message === "PASSWORD_REQUIRED") {
          return jsonResponse(
            createProtocolError(
              "PASSWORD_REQUIRED",
              "Password is required for this resource."
            ),
            401
          )
        }
        if (message === "INVALID_PASSWORD") {
          return jsonResponse(
            createProtocolError(
              "INVALID_PASSWORD",
              "The supplied password was rejected."
            ),
            401
          )
        }
        if (message === "RATE_LIMITED") {
          return jsonResponse(
            createProtocolError(
              "RATE_LIMITED",
              "Plugin Server capacity is exhausted for the current period."
            ),
            429
          )
        }
        if (message === "UNSUPPORTED_URL") {
          return jsonResponse(
            createProtocolError(
              "UNSUPPORTED_URL",
              "The target URL is not supported."
            ),
            400
          )
        }
        return jsonResponse(
          createProtocolError(
            "TEMPORARY_FAILURE",
            message || "Failed to extract links."
          ),
          500
        )
      }
    },
  }
}

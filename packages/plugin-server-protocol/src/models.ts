export interface PluginServerMatcher {
  readonly hosts: readonly string[]
  readonly hostPatterns?: readonly string[]
  readonly pathPatterns?: readonly string[]
  readonly schemes?: readonly string[]
}

export type JsonPrimitive = boolean | null | number | string

export type JsonValue = JsonPrimitive | readonly JsonValue[] | JsonObject

export interface JsonObject {
  readonly [property: string]: JsonValue
}

export interface PluginServerManifest {
  readonly protocolVersion: string
  readonly pluginServerId: string
  readonly displayName: string
  readonly hasIcon?: boolean
  readonly iconUrl?: string
  readonly homepage?: string
  readonly auth: {
    readonly type: "bearer"
  }
  readonly usage: {
    readonly endpoint: "/usage"
  }
  readonly matchers: readonly PluginServerMatcher[]
  readonly features: {
    readonly password: boolean
    readonly lazyNodes: boolean
    readonly basicAuth?: boolean
    readonly discovery?: boolean
  }
  readonly extensions: object
}

export interface UsageMetric {
  readonly id: string
  readonly label: string
  readonly used: number
  readonly limit: number
  readonly unit: string
  readonly period: "daily" | "monthly"
  readonly resetsAt: string
  readonly pluginId?: string
}

export interface UsageResponse {
  readonly metrics: readonly UsageMetric[]
}

export type RangeRequestCapability = "supported" | "unsupported" | "unknown"

export type ExpirySource = "signed-url" | "expires-header" | "cache-control"

export interface GroupNode {
  readonly kind: "group"
  readonly id?: string
  readonly label: string
  readonly badge?: string
  readonly size?: string
  readonly sourceName?: string
  readonly selectable?: boolean
  readonly children: readonly MediaNode[]
}

export interface ResolvableNode {
  readonly kind: "resolvable"
  readonly id?: string
  readonly label: string
  readonly nodeUrl?: string
  readonly resourceId?: string
  readonly resolutionKind?: "folder" | "mirrors"
  readonly badge?: string
  readonly size?: string
  readonly sourceName?: string
}

export interface PlayableNode {
  readonly kind: "playable"
  readonly id?: string
  readonly label: string
  readonly url: string
  readonly badge?: string
  readonly size?: string
  readonly sourceName?: string
  readonly expiry?: number
  readonly expirySource?: ExpirySource
  readonly status?: "up" | "down" | "unknown"
  readonly rangeRequest?: RangeRequestCapability
}

export type MediaNode = GroupNode | ResolvableNode | PlayableNode

export interface SourceInput {
  readonly kind: "source"
  readonly sourceUrl: string
}

export interface NodeInput {
  readonly kind: "node"
  readonly nodeUrl: string
  readonly resourceId?: string
}

export interface ExtractRequest {
  readonly input: SourceInput | NodeInput
  readonly pluginId?: string
  readonly password?: string
  readonly basicAuth?: HttpBasicAuth
  readonly proxy?: ProxyCredential
}

export interface ProxyCredential {
  readonly provider: "scrape-do"
  readonly token: string
}

export interface HttpBasicAuth {
  readonly username: string
  readonly password: string
}

export interface ExtractedHttpBasicAuth {
  readonly basicAuth?: HttpBasicAuth
  readonly url: string
}

export interface ExtractPending {
  /** Seconds until the client should re-issue the same extract request. */
  readonly retryAfterSeconds: number
  /**
   * Optional opaque handle the server can use to correlate the retry with
   * the deferred work; clients send it back untouched on the retry's node
   * input `resourceId`.
   */
  readonly resumeNodeId?: string
}

export interface ExtractSuccessResponse {
  readonly plugin: {
    readonly pluginServerId: string
    readonly displayName: string
    readonly iconUrl?: string
    readonly pluginId?: string
    readonly pluginName?: string
    readonly pluginIconUrl?: string
    readonly pageTitle?: string
    readonly audio?: string
  }
  readonly nodes: readonly MediaNode[]
  readonly extensions: object
  /**
   * Present when extraction was accepted but cannot finish within this
   * request. `nodes` is empty and the client must retry after the given
   * interval instead of treating the response as an empty success.
   */
  readonly pending?: ExtractPending
}

export interface ExtractProtocolError {
  readonly ok: false
  readonly error: {
    readonly code: ErrorCode
    readonly message: string
    readonly retryAfterSeconds?: number
  }
  readonly extensions: object
}

export interface VerifySuccessResponse {
  readonly ok: true
}

export interface VerifyErrorResponse {
  readonly ok: false
  readonly error: {
    readonly code: string
    readonly message: string
  }
}

export interface DiscoverRequest {
  readonly url: string
  readonly basicAuth?: HttpBasicAuth
}

export type DiscoverResponse =
  | { readonly matched: false }
  | {
      readonly matched: true
      readonly pluginId: string
      readonly confidence: "pattern" | "verified"
    }

export interface PluginMetadata {
  readonly id: string
  readonly displayName: string
  readonly description?: string
  readonly homepage?: string
  readonly hasIcon?: boolean
  readonly iconUrl?: string
  readonly status?: "active" | "maintenance" | "degraded" | "down"
  readonly version?: string
  readonly routesToPluginId?: string
  readonly matchStrategy?: "static" | "probe"
  readonly usageMultiplier?: number
  readonly proxyCreditUsage?: string
  readonly hosts: readonly string[]
  readonly matchers?: readonly PluginServerMatcher[]
  readonly credential?: PluginCredential
}

export interface PluginCredential {
  readonly kind: "domain-password" | "http-basic"
  readonly scope: "domain"
  readonly required: boolean
}

export interface LynvoManifestExtension {
  readonly plugins?: readonly PluginMetadata[]
  readonly proxyProvider?: "scrape-do"
}

export interface ContractIssue {
  readonly path: string
  readonly message: string
}

export interface ContractValidationResult {
  readonly ok: boolean
  readonly issues: readonly ContractIssue[]
}

export interface ContractParseResult<Value> extends ContractValidationResult {
  readonly value?: Value
}

export interface PluginServerRuntimeContext<Env> {
  readonly request: Request
  readonly env: Env
}

export interface PluginServerRuntimeAuth<Env> {
  readonly validate: (
    context: PluginServerRuntimeContext<Env>
  ) => Promise<boolean> | boolean
}

export interface PluginServerRuntimeExtractOptions<Env> {
  readonly request: ExtractRequest
  readonly targetUrl: string
  readonly env: Env
}

export interface PluginServerRuntimeDiscoverOptions<Env> {
  readonly request: DiscoverRequest
  readonly targetUrl: string
  readonly env: Env
}

export type PluginServerRuntimeManifest<Env> =
  | PluginServerManifest
  | ((
      context: PluginServerRuntimeContext<Env>
    ) => Promise<PluginServerManifest> | PluginServerManifest)

export interface PluginServerRuntimeAcceptedContext<Env> {
  readonly request: ExtractRequest
  readonly targetUrl: string
  readonly manifest: PluginServerManifest
  readonly matchedPluginId?: string
  readonly runtimeContext: PluginServerRuntimeContext<Env>
}

export interface PluginServerRuntimeResultContext<Env> {
  readonly request: ExtractRequest
  readonly result: ExtractSuccessResponse | ExtractProtocolError
  readonly runtimeContext: PluginServerRuntimeContext<Env>
}

export interface PluginServerRuntimeOptions<Env> {
  readonly manifest: PluginServerRuntimeManifest<Env>
  readonly auth: PluginServerRuntimeAuth<Env>
  readonly extract: (
    options: PluginServerRuntimeExtractOptions<Env>
  ) => Promise<ExtractSuccessResponse> | ExtractSuccessResponse
  readonly discover?: (
    options: PluginServerRuntimeDiscoverOptions<Env>
  ) => Promise<DiscoverResponse> | DiscoverResponse
  readonly usage: (
    context: PluginServerRuntimeContext<Env>
  ) => Promise<UsageResponse> | UsageResponse
  readonly onError?: (
    cause: unknown,
    context: PluginServerRuntimeContext<Env>
  ) => void
  /**
   * Observability hooks. They observe values the runtime already decoded
   * (request, matched plugin, result) so servers can log and meter without
   * re-parsing bodies or re-running matchers. Hook failures never fail the
   * request; they are routed to onError.
   */
  readonly onExtractAccepted?: (
    context: PluginServerRuntimeAcceptedContext<Env>
  ) => void | Promise<void>
  readonly onExtractResult?: (
    context: PluginServerRuntimeResultContext<Env>
  ) => void | Promise<void>
}

export interface PluginServerRuntime<Env> {
  handleManifest: (request: Request, env: Env) => Promise<Response>
  handleVerify: (request: Request, env: Env) => Promise<Response>
  handleUsage: (request: Request, env: Env) => Promise<Response>
  handleDiscover: (request: Request, env: Env) => Promise<Response>
  handleExtract: (request: Request, env: Env) => Promise<Response>
}

export const PROTOCOL_VERSION = "1.0" as const

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
  new Set<string>(SUPPORTED_PROTOCOL_VERSIONS).has(version)

/**
 * A manifest version is wire-compatible when its major version matches the
 * protocol major version: minor versions are additive by contract, so a
 * server on a newer minor within the same major must still satisfy an older
 * client. Unknown fields are ignored; custom data rides `extensions`.
 */
export const isCompatibleProtocolVersion = (version: string): boolean => {
  const parsed = /^(\d+)\.(\d+)$/.exec(version)
  const current = /^(\d+)\.(\d+)$/.exec(PROTOCOL_VERSION)
  return parsed !== null && current !== null && parsed[1] === current[1]
}

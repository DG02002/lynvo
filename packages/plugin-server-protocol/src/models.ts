export interface PluginServerMatcher {
  hosts: string[]
  hostPatterns?: string[]
  pathPatterns?: string[]
  schemes?: string[]
}

export type JsonPrimitive = boolean | null | number | string

export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject

export interface JsonObject {
  [property: string]: JsonValue
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
  extensions: object
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

export type RangeRequestCapability = "supported" | "unsupported" | "unknown"

export type ExpirySource = "signed-url" | "expires-header" | "cache-control"

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
  expirySource?: ExpirySource
  status?: "up" | "down" | "unknown"
  rangeRequest?: RangeRequestCapability
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
  extensions: object
}

export interface ExtractProtocolError {
  ok: false
  error: {
    code: ErrorCode
    message: string
    retryAfterSeconds?: number
  }
  extensions: object
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
  matchStrategy?: "static" | "probe"
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

export interface ContractParseResult<Value> extends ContractValidationResult {
  value?: Value
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
  onError?: (cause: unknown, context: PluginServerRuntimeContext<Env>) => void
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
  new Set<string>(SUPPORTED_PROTOCOL_VERSIONS).has(version)

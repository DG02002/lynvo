import type { Effect } from "effect"
import type { ExtractedLink, MetaData } from "../../../features/links/types"
import type { HttpBasicAuth } from "@dg02002/lynvo-plugin-server-protocol"
import type {
  ExtractionError,
  UsageLimitError,
  ValidationError,
  UnauthorizedError,
  BackendError,
} from "../errors"

export interface ExtractOptions {
  readonly url: string
  readonly requestId: string
  readonly pluginServerId?: string
  readonly pluginId?: string
  readonly kind?: "source" | "node"
  readonly userId?: string
  readonly inlineBasicAuth?: HttpBasicAuth
}

export interface ExtractionPending {
  readonly retryAfterSeconds: number
  readonly resumeNodeId?: string
}

export interface ExtractionResult {
  readonly links: ReadonlyArray<ExtractedLink>
  readonly meta?: ExtractionMetadata
  /**
   * Present when the Plugin Server accepted the extraction but deferred it;
   * consumers must retry after the interval instead of treating the empty
   * link list as a completed extraction.
   */
  readonly pending?: ExtractionPending
}

export interface ExtractionMetadata extends MetaData {
  schemaVersion: 3
}

export interface MetadataOptions {
  readonly url: string
  readonly requestId: string
  readonly userId?: string
  readonly env: Env
  readonly pluginServerId?: string
  readonly pluginId?: string
}

export interface MetadataResult {
  readonly filename: string
  readonly pluginName: string
  readonly pluginIcon?: string
  readonly pluginId?: string
  readonly sourceName?: string
  readonly sourceIconUrl?: string
  readonly sourceStatus?: "active" | "maintenance" | "degraded" | "down"
  readonly sourceVersion?: string
  readonly sourceCredentialKind?: "domain-password" | "http-basic"
  readonly routeSourceName?: string
  readonly routeSourceIconUrl?: string
  readonly pluginServerId?: string
}

export interface RegisteredPluginServer {
  readonly id: string
  readonly baseUrl: string
  readonly apiKey: string
  /** Decrypted user proxy key; sent per extraction when the server declares the capability. */
  readonly proxyToken?: string
  readonly manifest: string
  readonly enabled: boolean
  readonly priority: number
  readonly verificationStatus?: string
  readonly lastVerifiedAt?: number | null
  readonly lastManifestRefreshAt?: number | null
}

export interface ExtractionServiceContract {
  readonly extract: (
    options: ExtractOptions
  ) => Effect.Effect<
    ExtractionResult,
    ExtractionError | UsageLimitError | ValidationError | UnauthorizedError
  >
  readonly getMetadata: (
    options: MetadataOptions
  ) => Effect.Effect<MetadataResult, ValidationError | BackendError>
}

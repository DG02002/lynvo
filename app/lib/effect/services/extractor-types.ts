import { Effect } from "effect"
import type { ExtractedLink } from "../../../features/links/types"
import type {
  ExtractionError,
  ValidationError,
  UnauthorizedError,
  ConvexError,
} from "../errors"

export interface ExtractOptions {
  readonly url: string
  readonly requestId: string
  readonly workerId?: string
  readonly kind?: "source" | "node"
  readonly userId?: string
  readonly accessToken?: string
}

export interface ExtractionResult {
  readonly links: ReadonlyArray<ExtractedLink>
  readonly meta?: Record<string, unknown>
}

export interface MetadataOptions {
  readonly url: string
  readonly requestId: string
  readonly userId?: string
  readonly accessToken?: string
  readonly env: Env
}

export interface MetadataResult {
  readonly filename: string
  readonly pluginName: string
  readonly pluginIcon?: string
  readonly sourceId?: string
  readonly sourceName?: string
  readonly sourceIconUrl?: string
  readonly sourceStatus?: "active" | "maintenance" | "degraded" | "down"
  readonly sourceVersion?: string
  readonly routeSourceName?: string
  readonly routeSourceIconUrl?: string
  readonly workerId?: string
}

export interface RegisteredWorker {
  readonly _id: string
  readonly baseUrl: string
  readonly apiKey: string
  readonly manifest: string
  readonly enabled: boolean
  readonly priority: number
  readonly verificationStatus?: string
  readonly lastVerifiedAt?: number
  readonly lastManifestRefreshAt?: number
}

export interface ExtractorServiceShape {
  readonly extract: (
    options: ExtractOptions
  ) => Effect.Effect<
    ExtractionResult,
    ExtractionError | ValidationError | UnauthorizedError
  >
  readonly getMetadata: (
    options: MetadataOptions
  ) => Effect.Effect<MetadataResult, ValidationError | ConvexError>
}

import type { ExtractedLink } from "../types"

export {}

declare global {
  interface MediaClassificationCandidate {
    readonly kind:
      | "movie"
      | "episode"
      | "episode-range"
      | "season"
      | "unknown"
      | "ambiguous"
    readonly originalFilename: string
    readonly rawText: string
    readonly title?: string
    readonly normalizedTitle?: string
    readonly year?: number
    readonly seasonNumber?: number
    readonly episodeNumber?: number
    readonly episodeEnd?: number
    readonly confidence: "high" | "medium" | "low"
  }

  interface SourceVariantProjection {
    readonly id?: string
    readonly savedLinkId: string
    readonly occurrenceKey: string
    readonly nodeKey: string
    readonly nodePath: string
    readonly label: string
    readonly sourceName: string
    readonly quality?: string
    readonly size?: string
    readonly status?: "up" | "down"
    readonly mediaNodeKind?: "group" | "resolvable" | "playable"
    readonly resolutionKind?: "folder" | "mirrors"
    readonly target?: string
    readonly node: ExtractedLink
    readonly timestamp: number
  }

  interface TitleEntryProjection {
    readonly id?: string
    readonly entryKey: string
    readonly kind:
      | "movie"
      | "episode"
      | "episode-range"
      | "container"
      | "unknown"
    readonly seasonNumber?: number
    readonly episodeStart?: number
    readonly episodeEnd?: number
    readonly displayLabel: string
    readonly metadataTitle?: string
    readonly metadataState: "pending" | "available" | "unavailable" | "failed"
    readonly stillPath?: string
    readonly sources: readonly SourceVariantProjection[]
  }

  interface TitleGroupProjection {
    readonly id?: string
    readonly identityKey: string
    readonly mediaKind: "movie" | "tv-season" | "unmatched"
    readonly displayTitle: string
    readonly year?: number
    readonly seasonNumber?: number
    readonly metadataState: "pending" | "available" | "unavailable" | "failed"
    readonly provider?: string
    readonly posterPath?: string
    readonly backdropPath?: string
    readonly overview?: string
    readonly metadataFetchedAt?: number
    readonly metadataExpiresAt?: number
    readonly lastAddedAt: number
    readonly sourceCount: number
    readonly entries: readonly TitleEntryProjection[]
  }

  interface TitleDateGroupProjection {
    readonly key: string
    readonly label: string
    readonly groups: readonly TitleGroupProjection[]
  }

  interface TitleProjection {
    readonly dateGroups: readonly TitleDateGroupProjection[]
    readonly unmatchedGroups: readonly TitleGroupProjection[]
  }

  interface TitleGroupsState {
    readonly projection?: TitleProjection
    readonly error?: string
    readonly isLoading: boolean
    readonly retry: () => void
  }

  interface TitleGroupsDataSource {
    readonly list: () => Promise<{
      readonly projection: TitleProjection
      readonly dataVersion: number
    }>
  }

  interface UseTitleGroupsOptions {
    readonly enabled: boolean
    readonly dataVersion: number
    readonly initialProjection?: TitleProjection
  }

  interface UseTitleGroupsRuntime {
    readonly userId?: string
    readonly dataSource: TitleGroupsDataSource
  }

  interface TitleGroupReconciliationGuard {
    readonly linkId: string
    readonly extractionState: string
    readonly extractionAttempts: number
    readonly leaseExpiresAt: number | null
  }
}

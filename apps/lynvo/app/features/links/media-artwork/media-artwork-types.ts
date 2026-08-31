import type { LinkListItem } from "../types"

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

  interface MediaArtworkIdentity {
    readonly providerId: number
    readonly title: string
    readonly year?: number
    /** Picks the provider namespace for by-id lookups. */
    readonly mediaKind?: "movie" | "tv"
  }

  interface MediaArtworkCandidate {
    readonly providerId: number
    readonly title: string
    readonly year?: number
    readonly mediaKind?: "movie" | "tv"
    readonly posterPath?: string
  }

  interface MediaArtworkRequest {
    readonly mediaKind: "movie" | "tv"
    readonly title: string
    readonly year?: number
    readonly seasonNumber?: number
    readonly episodeNumber?: number
    /** When set, artwork resolves by immutable id; title matching is skipped. */
    readonly providerId?: number
  }

  interface MediaArtworkResult {
    readonly posterPath?: string
    readonly stillPath?: string
    readonly episodeTitle?: string
    readonly identity?: MediaArtworkIdentity
    readonly candidates?: readonly MediaArtworkCandidate[]
    /** Transient provider failure; callers must not negative-cache it. */
    readonly failed?: boolean
  }

  interface HybridCardGroup {
    readonly key: string
    readonly displayTitle: string
    readonly artworkRequest?: MediaArtworkRequest
    readonly lastAddedAt: number
    readonly items: readonly LinkListItem[]
  }

  interface SharedSeasonIdentity {
    readonly requestTitle: string
    readonly normalizedTitle: string
    readonly year?: number
    readonly seasonNumber: number
    readonly displayTitle: string
  }
}

import type { MediaArtworkRequest } from "../../../../shared/api-contracts"
import type { LinkListItem } from "../types"

export interface GalleryGroup {
  readonly key: string
  readonly displayTitle: string
  readonly artworkRequest?: MediaArtworkRequest
  readonly lastAddedAt: number
  readonly items: readonly LinkListItem[]
}

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
    readonly episodeTitle?: string
    readonly confidence: "high" | "medium" | "low"
  }

  interface SharedSeasonIdentity {
    readonly requestTitle: string
    readonly normalizedTitle: string
    readonly year?: number
    readonly seasonNumber: number
    readonly displayTitle: string
  }
}

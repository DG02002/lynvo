import type { LinkListItem } from "../types"

export {}

declare global {
  interface MediaArtworkRequest {
    readonly mediaKind: "movie" | "tv"
    readonly title: string
    readonly year?: number
    readonly seasonNumber?: number
    readonly episodeNumber?: number
  }

  interface MediaArtworkResult {
    readonly posterPath?: string
    readonly stillPath?: string
  }

  interface HybridCardGroup {
    readonly key: string
    readonly displayTitle: string
    readonly artworkRequest?: MediaArtworkRequest
    readonly lastAddedAt: number
    readonly items: readonly LinkListItem[]
  }
}

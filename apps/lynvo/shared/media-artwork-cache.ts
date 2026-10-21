import type { MediaArtworkRequest, MediaArtworkResult } from "./api-contracts"

// Increment when title matching changes so unresolved TMDB candidates retry once.
export const MEDIA_ARTWORK_TITLE_MATCH_VERSION = 1
export const MEDIA_ARTWORK_TITLE_MATCH_VERSION_HEADER =
  "x-lynvo-artwork-title-match-version"

export const getMediaArtworkTitleMatchCacheKeyParts = (
  request: Pick<MediaArtworkRequest, "requireExactTitleMatch">
): readonly string[] => (request.requireExactTitleMatch ? ["exact-title"] : [])

export const isUnresolvedMediaArtworkResult = (
  result: MediaArtworkResult | null | undefined
): boolean =>
  Boolean(result?.candidates?.length && !result.posterPath && !result.stillPath)

export const isCurrentMediaArtworkTitleMatchVersion = (
  value: number | string | null | undefined
): boolean => String(value) === String(MEDIA_ARTWORK_TITLE_MATCH_VERSION)

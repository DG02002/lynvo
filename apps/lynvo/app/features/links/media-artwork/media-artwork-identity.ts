import {
  getMediaFilenameMatchingText,
  isNonMediaFilename,
  parseMediaFilename,
} from "./media-filename-parser"

interface MediaArtworkRequestOptions {
  readonly isContainer?: boolean
}

const getTwoDigitLabel = (value: number): string =>
  String(value).padStart(2, "0")

export const getMediaArtworkRequest = (
  label: string,
  parentFolderName?: string,
  options: MediaArtworkRequestOptions = {}
): MediaArtworkRequest | undefined => {
  const candidate = parseMediaFilename(label, parentFolderName)
  if (!candidate.title) {
    return undefined
  }

  if (candidate.kind === "movie") {
    if (options.isContainer && candidate.year === undefined) {
      return undefined
    }
    return {
      mediaKind: "movie",
      title: candidate.title,
      year: candidate.year,
    }
  }

  if (candidate.kind === "season" && candidate.seasonNumber !== undefined) {
    return {
      mediaKind: "tv",
      title: candidate.title,
      year: candidate.year,
      seasonNumber: candidate.seasonNumber,
    }
  }

  if (
    (candidate.kind === "episode" || candidate.kind === "episode-range") &&
    candidate.seasonNumber !== undefined &&
    candidate.episodeNumber !== undefined
  ) {
    return {
      mediaKind: "tv",
      title: candidate.title,
      year: candidate.year,
      seasonNumber: candidate.seasonNumber,
      episodeNumber: candidate.episodeNumber,
    }
  }

  return undefined
}

export const hasEpisodeMarker = (
  label: string,
  parentFolderName?: string
): boolean => {
  const candidate = parseMediaFilename(label, parentFolderName)
  return candidate.kind === "episode" || candidate.kind === "episode-range"
}

export const isEpisodeOnlyListing = (
  labels: readonly string[],
  parentFolderName?: string
): boolean => {
  const mediaLabels = labels.filter((label) => !isNonMediaFilename(label))
  return (
    mediaLabels.length > 0 &&
    mediaLabels.every((label) => hasEpisodeMarker(label, parentFolderName))
  )
}

export const getMediaDisplayTitle = (
  label: string,
  parentFolderName?: string
): string | undefined => {
  const candidate = parseMediaFilename(label, parentFolderName)
  if (!candidate.title) {
    return undefined
  }

  if (candidate.kind === "movie") {
    const titleWordCount = candidate.title.split(" ").filter(Boolean).length
    const labelWordCount = getMediaFilenameMatchingText(label)
      .split(" ")
      .filter(Boolean).length
    const isTrustworthyTitle =
      candidate.year !== undefined ||
      titleWordCount >= 2 ||
      titleWordCount >= labelWordCount
    if (!isTrustworthyTitle) {
      return undefined
    }
    return candidate.year
      ? `${candidate.title} (${candidate.year})`
      : candidate.title
  }

  if (
    candidate.kind === "episode" &&
    candidate.seasonNumber !== undefined &&
    candidate.episodeNumber !== undefined
  ) {
    return `${candidate.title} S${getTwoDigitLabel(candidate.seasonNumber)}E${getTwoDigitLabel(candidate.episodeNumber)}`
  }

  if (
    candidate.kind === "episode-range" &&
    candidate.seasonNumber !== undefined &&
    candidate.episodeNumber !== undefined
  ) {
    return `${candidate.title} S${getTwoDigitLabel(candidate.seasonNumber)}E${getTwoDigitLabel(candidate.episodeNumber)}-E${getTwoDigitLabel(candidate.episodeEnd ?? candidate.episodeNumber)}`
  }

  if (candidate.kind === "season" && candidate.seasonNumber !== undefined) {
    return `${candidate.title} Season ${candidate.seasonNumber}`
  }

  return undefined
}

export const getMediaEpisodeDisplayTitle = (
  label: string,
  episodeTitle?: string,
  parentFolderName?: string
): string => {
  const fallbackTitle = getMediaDisplayTitle(label, parentFolderName) ?? label
  const displayTitle = episodeTitle ?? fallbackTitle
  const { episodeNumber } = parseMediaFilename(label, parentFolderName)
  return episodeNumber === undefined
    ? displayTitle
    : `${episodeNumber}. ${displayTitle}`
}

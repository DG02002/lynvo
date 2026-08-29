import {
  MEDIA_FILENAME_MAX_EPISODE_DIGITS,
  MEDIA_YEAR_MAX,
  MEDIA_YEAR_MIN,
} from "~/lib/constants"

const MEDIA_EXTENSION_PATTERN =
  /\.(?:3g2|avi|flac|flv|iso|m2ts|m4v|mkv|mov|mp4|mpeg|mpg|ts|webm|wmv)$/i
const YEAR_PATTERN = /(?:^|\D)((?:19|20)\d{2})(?=\D|$)/g
const EPISODE_RANGE_PATTERN = new RegExp(
  `\\bS(\\d{1,3})\\s*[\\[\\(\\-]?\\s*E(\\d{1,${MEDIA_FILENAME_MAX_EPISODE_DIGITS}})\\s*[-–]\\s*(?:E)?(\\d{1,${MEDIA_FILENAME_MAX_EPISODE_DIGITS}})\\s*[\\]\\)]?`,
  "i"
)
const EPISODE_PATTERN = new RegExp(
  `\\bS(\\d{1,3})\\s*[\\s._-]*E(\\d{1,${MEDIA_FILENAME_MAX_EPISODE_DIGITS}})\\b`,
  "gi"
)
const SEASON_PATTERN = /\b(?:SEASON\s*|S)(\d{1,3})\b/i
const CHILD_EPISODE_PATTERN = new RegExp(
  `\\b(?:EPISODE|EP)\\s*(\\d{1,${MEDIA_FILENAME_MAX_EPISODE_DIGITS}})\\b`,
  "i"
)
const MALFORMED_MARKER_PATTERN =
  /(?:^|\s)S\d{1,3}\s*[\s._-]*E(?!\d)|(?:^|\s)S[A-Z]{2,5}E[A-Z]{2,5}\b/i
const TECHNICAL_TOKEN_PATTERN =
  /\b(?:2160p|1440p|1080p|720p|576p|480p|4k|8k|\d{3,4}x\d{3,4}|\d{1,2}bit|hdr10?\+?|hdr|dolby\s+vision|dv|web[- ]?dl|webrip|web|bluray|blu[- ]?ray|brrip|bdrip|hdtc|hdtv|hevc|x264|x265|h\.?264|h\.?265|av1|aac|dts|ddp|atmos|dual\s+audio|multi\s+audio|remux|final\s+cut|subs?|subtitles?|bd|itunes)\b/i
const GENERIC_TITLE_PATTERN = /^(?:file|sample|video|movie|episode|untitled)$/i

interface MarkerMatch {
  readonly kind: "episode" | "episode-range" | "season"
  readonly index: number
  readonly endIndex: number
  readonly seasonNumber: number
  readonly episodeNumber?: number
  readonly episodeEnd?: number
}

interface YearMatch {
  readonly year: number
  readonly index: number
}

const stripMediaExtension = (filename: string): string =>
  filename.replace(MEDIA_EXTENSION_PATTERN, "")

const normalizeSeparators = (value: string): string =>
  value.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim()

const getMatchingText = (filename: string): string =>
  normalizeSeparators(stripMediaExtension(filename))

const getAllYearMatches = (value: string): YearMatch[] => {
  const matches: YearMatch[] = []
  YEAR_PATTERN.lastIndex = 0
  for (
    let match = YEAR_PATTERN.exec(value);
    match;
    match = YEAR_PATTERN.exec(value)
  ) {
    const year = Number(match[1])
    if (year >= MEDIA_YEAR_MIN && year <= MEDIA_YEAR_MAX) {
      matches.push({
        year,
        index: match.index + match[0].indexOf(match[1] ?? ""),
      })
    }
  }
  return matches
}

const isEnclosedYear = (value: string, index: number): boolean => {
  const before = value[index - 1] ?? ""
  const after = value[index + 4] ?? ""
  return (before === "(" && after === ")") || (before === "[" && after === "]")
}

/**
 * Some titles are themselves years ("2012 (2009)", "1917 (2019)"): a year
 * leading the title is part of the title when any later year exists, and a
 * lone leading year is never treated as the release year.
 */
const getYearMatch = (value: string): YearMatch | undefined => {
  const matches = getAllYearMatches(value)
  if (matches.length === 0) {
    return undefined
  }
  const [leadingMatch, ...laterMatches] = matches
  const titleIsYearLeading =
    leadingMatch !== undefined &&
    value.slice(0, leadingMatch.index).trim() === ""
  if (!titleIsYearLeading) {
    return leadingMatch
  }
  if (laterMatches.length === 0) {
    return undefined
  }
  return (
    laterMatches.find((match) => isEnclosedYear(value, match.index)) ??
    laterMatches[0]
  )
}

const normalizeTitle = (value: string): string | undefined => {
  const withoutReleaseGroups = value.replace(/^\s*(?:\[[^\]]+\]\s*)+/, "")
  const withoutTechnicalTail = withoutReleaseGroups
    .replace(TECHNICAL_TOKEN_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim()
  const withoutDanglingPunctuation = withoutTechnicalTail
    .replace(/^[\s[({\-_,.]+|[\s\])}({\-_,.]+$/g, "")
    .trim()
  const normalized = withoutDanglingPunctuation
    .replace(/(?<=\w)-(?=\w)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!normalized || GENERIC_TITLE_PATTERN.test(normalized)) {
    return undefined
  }
  return normalized
}

const getNormalizedTitleIdentity = (title: string): string =>
  title
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")

const toAmbiguousCandidate = (
  originalFilename: string
): MediaClassificationCandidate => ({
  kind: "ambiguous",
  originalFilename,
  rawText: originalFilename,
  confidence: "low",
})

const toUnknownCandidate = (
  originalFilename: string
): MediaClassificationCandidate => ({
  kind: "unknown",
  originalFilename,
  rawText: originalFilename,
  confidence: "low",
})

const findMarkerMatch = (matchingText: string): MarkerMatch | undefined => {
  const rangeMatch = EPISODE_RANGE_PATTERN.exec(matchingText)
  if (rangeMatch) {
    return {
      kind: "episode-range",
      index: rangeMatch.index,
      endIndex: rangeMatch.index + rangeMatch[0].length,
      seasonNumber: Number(rangeMatch[1]),
      episodeNumber: Number(rangeMatch[2]),
      episodeEnd: Number(rangeMatch[3]),
    }
  }

  EPISODE_PATTERN.lastIndex = 0
  const episodeMatches = [...matchingText.matchAll(EPISODE_PATTERN)]
  const firstEpisodeMatch = episodeMatches[0]
  if (firstEpisodeMatch && episodeMatches.length === 1) {
    return {
      kind: "episode",
      index: firstEpisodeMatch.index ?? 0,
      endIndex: (firstEpisodeMatch.index ?? 0) + firstEpisodeMatch[0].length,
      seasonNumber: Number(firstEpisodeMatch[1]),
      episodeNumber: Number(firstEpisodeMatch[2]),
    }
  }
  if (episodeMatches.length > 1) {
    return undefined
  }

  const seasonMatch = SEASON_PATTERN.exec(matchingText)
  if (!seasonMatch) {
    return undefined
  }
  return {
    kind: "season",
    index: seasonMatch.index,
    endIndex: seasonMatch.index + seasonMatch[0].length,
    seasonNumber: Number(seasonMatch[1]),
  }
}

const createCandidate = ({
  originalFilename,
  matchingText,
  marker,
  parentCandidate,
}: {
  readonly originalFilename: string
  readonly matchingText: string
  readonly marker?: MarkerMatch
  readonly parentCandidate?: MediaClassificationCandidate
}): MediaClassificationCandidate => {
  const yearMatch = getYearMatch(matchingText)
  const markerTitleText = marker
    ? matchingText.slice(0, marker.index)
    : matchingText
  const technicalMatch = TECHNICAL_TOKEN_PATTERN.exec(markerTitleText)
  const titleEndIndex = technicalMatch?.index ?? markerTitleText.length
  const titleBeforeYear = yearMatch
    ? matchingText.slice(0, Math.min(yearMatch.index, titleEndIndex))
    : markerTitleText.slice(0, titleEndIndex)
  const title = normalizeTitle(titleBeforeYear)
  const resolvedTitle = title ?? parentCandidate?.title
  const resolvedSeason = marker?.seasonNumber ?? parentCandidate?.seasonNumber
  const resolvedYear = yearMatch?.year ?? parentCandidate?.year
  const normalizedTitle = resolvedTitle
    ? getNormalizedTitleIdentity(resolvedTitle)
    : undefined

  if (!resolvedTitle || !normalizedTitle) {
    return toUnknownCandidate(originalFilename)
  }

  if (marker?.kind === "episode-range") {
    return {
      kind: "episode-range",
      originalFilename,
      rawText: originalFilename,
      title: resolvedTitle,
      normalizedTitle,
      year: resolvedYear,
      seasonNumber: resolvedSeason,
      episodeNumber: marker.episodeNumber,
      episodeEnd: marker.episodeEnd,
      confidence: "high",
    }
  }

  if (marker?.kind === "episode") {
    return {
      kind: "episode",
      originalFilename,
      rawText: originalFilename,
      title: resolvedTitle,
      normalizedTitle,
      year: resolvedYear,
      seasonNumber: resolvedSeason,
      episodeNumber: marker.episodeNumber,
      confidence: "high",
    }
  }

  if (resolvedSeason !== undefined) {
    return {
      kind: "season",
      originalFilename,
      rawText: originalFilename,
      title: resolvedTitle,
      normalizedTitle,
      year: resolvedYear,
      seasonNumber: resolvedSeason,
      confidence: marker ? "high" : "medium",
    }
  }

  return {
    kind: "movie",
    originalFilename,
    rawText: originalFilename,
    title: resolvedTitle,
    normalizedTitle,
    year: resolvedYear,
    confidence: yearMatch ? "high" : "medium",
  }
}

const parseFilename = (
  originalFilename: string,
  parentCandidate?: MediaClassificationCandidate
): MediaClassificationCandidate => {
  if (!originalFilename.trim()) {
    return toUnknownCandidate(originalFilename)
  }

  const matchingText = getMatchingText(originalFilename)
  if (!matchingText) {
    return toUnknownCandidate(originalFilename)
  }

  const marker = findMarkerMatch(matchingText)
  const hasRepeatedEpisodeMarkers = (() => {
    EPISODE_PATTERN.lastIndex = 0
    return [...matchingText.matchAll(EPISODE_PATTERN)].length > 1
  })()
  const hasMalformedMarker = MALFORMED_MARKER_PATTERN.test(matchingText)
  if (hasRepeatedEpisodeMarkers || hasMalformedMarker) {
    return toAmbiguousCandidate(originalFilename)
  }

  const childEpisodeMatch = CHILD_EPISODE_PATTERN.exec(matchingText)
  if (
    !marker &&
    childEpisodeMatch &&
    parentCandidate?.kind === "season" &&
    parentCandidate.seasonNumber !== undefined
  ) {
    return createCandidate({
      originalFilename,
      matchingText,
      parentCandidate,
      marker: {
        kind: "episode",
        index: childEpisodeMatch.index,
        endIndex: childEpisodeMatch.index + childEpisodeMatch[0].length,
        seasonNumber: parentCandidate.seasonNumber,
        episodeNumber: Number(childEpisodeMatch[1]),
      },
    })
  }

  return createCandidate({
    originalFilename,
    matchingText,
    marker,
    parentCandidate,
  })
}

export const getMediaFilenameMatchingText = (filename: string): string =>
  getMatchingText(filename)

export const parseMediaFilename = (
  filename: string,
  parentFolderName?: string
): MediaClassificationCandidate => {
  const parentCandidate = parentFolderName
    ? parseFilename(parentFolderName)
    : undefined
  return parseFilename(filename, parentCandidate)
}

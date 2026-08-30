import {
  createTmdbAdapter,
  type TmdbAdapter,
  type TmdbSearchResult,
} from "./tmdb-adapter"
import {
  doesSeasonNameCoverRemainder,
  selectBestSearchResult,
  selectLeadingTitleMatch,
} from "./search-result-selection"

export interface MediaArtworkIdentity {
  readonly providerId: number
  readonly title: string
  readonly year?: number
  readonly mediaKind?: "movie" | "tv"
}

export interface MediaArtworkCandidate {
  readonly providerId: number
  readonly title: string
  readonly year?: number
  readonly mediaKind?: "movie" | "tv"
  readonly posterPath?: string
}

interface MediaArtworkLookupRequest {
  readonly title: string
  readonly mediaKind?: "movie" | "tv"
  readonly year?: number
  readonly seasonNumber?: number
  readonly episodeNumber?: number
  /** When present, artwork resolves by immutable id; no title matching. */
  readonly providerId?: number
}

export interface MediaArtworkLookupResult {
  readonly posterPath?: string
  readonly stillPath?: string
  readonly episodeTitle?: string
  /** The work this artwork belongs to; displayed so mismatches are visible. */
  readonly identity?: MediaArtworkIdentity
  /** Raw search candidates for the picker, title-based requests only. */
  readonly candidates?: readonly MediaArtworkCandidate[]
  /** Present when the provider attempt failed; callers must not cache it. */
  readonly failed?: boolean
}

export type MediaArtworkLookupOutcome =
  | { status: "resolved"; result: MediaArtworkLookupResult }
  | { status: "empty"; candidates?: readonly MediaArtworkCandidate[] }
  | { status: "failed" }

interface MediaArtworkLookupEnvironment {
  readonly TMDB_API_READ_ACCESS_TOKEN?: string
}

interface MediaArtworkLookupDependencies {
  readonly fetch: typeof globalThis.fetch
}

const failedOutcome: MediaArtworkLookupOutcome = { status: "failed" }
const emptyOutcome: MediaArtworkLookupOutcome = { status: "empty" }

const toIdentity = (result: TmdbSearchResult): MediaArtworkIdentity =>
  result.year === undefined
    ? { providerId: result.providerId, title: result.title }
    : {
        providerId: result.providerId,
        title: result.title,
        year: result.year,
      }

const toCandidates = (
  mediaKind: "movie" | "tv",
  results: readonly TmdbSearchResult[] | undefined
): readonly MediaArtworkCandidate[] | undefined =>
  results?.length
    ? results.slice(0, 5).map((result) => ({
        ...toIdentity(result),
        mediaKind,
        posterPath: result.posterPath,
      }))
    : undefined

/**
 * Identity-resolved lookups fetch by immutable provider id, so the result
 * cannot belong to a different work; the matching step does not run.
 */
const lookupArtworkById = async (
  adapter: TmdbAdapter,
  request: MediaArtworkLookupRequest
): Promise<MediaArtworkLookupOutcome> => {
  if (request.providerId === undefined) {
    return emptyOutcome
  }
  const details =
    request.mediaKind === "movie"
      ? await adapter.getMovieDetails(request.providerId)
      : await adapter.getTvDetails(request.providerId)
  if (details.kind !== "success" || !details.value) {
    return failedOutcome
  }
  return {
    status: "resolved",
    result: {
      posterPath: details.value.posterPath,
      identity: toIdentity({
        providerId: request.providerId,
        title: details.value.title,
        year: details.value.year,
      }),
    },
  }
}

/**
 * No confident match still leaves the picker something to choose from:
 * candidates ride along on the empty outcome instead of being discarded.
 */
const toEmptyOutcome = (
  mediaKind: "movie" | "tv",
  results: readonly TmdbSearchResult[] | undefined
): MediaArtworkLookupOutcome => ({
  status: "empty",
  candidates: toCandidates(mediaKind, results),
})

/**
 * Filenames regularly carry a mistaken year; a year-filtered search then
 * hides the real work entirely, so an unfiltered retry runs whenever the
 * filtered pass selects nothing. Title scoring still gates the result.
 */
const searchTvSelectingByTitle = async (
  adapter: TmdbAdapter,
  title: string,
  year: number | undefined
) => {
  const filteredSearch =
    year === undefined ? undefined : await adapter.searchTv(title, year)
  if (filteredSearch && filteredSearch.kind !== "success") {
    return filteredSearch
  }
  if (
    filteredSearch &&
    selectBestSearchResult(title, filteredSearch.value ?? [])
  ) {
    return filteredSearch
  }
  return adapter.searchTv(title)
}

const searchMovieSelectingByTitle = async (
  adapter: TmdbAdapter,
  title: string,
  year: number | undefined
) => {
  const filteredSearch =
    year === undefined ? undefined : await adapter.searchMovie(title, year)
  if (filteredSearch && filteredSearch.kind !== "success") {
    return filteredSearch
  }
  if (
    filteredSearch &&
    selectBestSearchResult(title, filteredSearch.value ?? [])
  ) {
    return filteredSearch
  }
  return adapter.searchMovie(title)
}

interface SubtitleSeasonArtwork {
  readonly posterPath: string | undefined
  readonly stillPath?: string
  readonly episodeTitle?: string
  readonly identity: MediaArtworkIdentity
}

interface SubtitleSeasonArtworkOptions {
  readonly episodeNumber?: number
  readonly episodeGroupNumber?: number
}

interface SubtitleSeasonArtworkLookupRequest {
  readonly adapter: TmdbAdapter
  readonly title: string
  readonly results: readonly TmdbSearchResult[]
  readonly options?: SubtitleSeasonArtworkOptions
}

/**
 * "Parent Title Subtitle" works live as named seasons of the parent show
 * on TMDB. When the parent surfaced in the results, its season list is
 * searched for one whose name covers the leftover query tokens; the file's
 * own season numbering cannot be trusted there (scene packs renumber
 * cours), so the matched season's artwork wins.
 */
const lookupSubtitleSeasonArtwork = async (
  request: SubtitleSeasonArtworkLookupRequest
): Promise<SubtitleSeasonArtwork | undefined> => {
  const { adapter, title, results, options = {} } = request
  const parentShow = selectLeadingTitleMatch(title, results)
  if (!parentShow) {
    return undefined
  }
  const seasonList = await adapter.getTvSeasonList(parentShow.providerId)
  if (seasonList.kind !== "success") {
    return undefined
  }
  const matchedSeason = (seasonList.value ?? []).find((season) =>
    doesSeasonNameCoverRemainder(title, parentShow.title, season.name)
  )
  if (!matchedSeason) {
    return undefined
  }
  const [seasonDetails, episodeDetails] = await Promise.all([
    adapter.getTvSeasonDetails(
      parentShow.providerId,
      matchedSeason.seasonNumber
    ),
    options.episodeNumber === undefined
      ? Promise.resolve(undefined)
      : adapter.getTvEpisodeDetails({
          providerId: parentShow.providerId,
          seasonNumber: matchedSeason.seasonNumber,
          episodeNumber: options.episodeNumber,
          episodeGroupName: matchedSeason.name,
          episodeGroupNumber: options.episodeGroupNumber,
        }),
  ])
  const episodeMetadata =
    episodeDetails?.kind === "success" ? episodeDetails.value : undefined
  return {
    posterPath:
      (seasonDetails.kind === "success"
        ? seasonDetails.value?.posterPath
        : undefined) ?? parentShow.posterPath,
    stillPath: episodeMetadata?.stillPath,
    episodeTitle: episodeMetadata?.title,
    identity: toIdentity(parentShow),
  }
}

const lookupEpisodeArtwork = async (
  adapter: TmdbAdapter,
  request: MediaArtworkLookupRequest
): Promise<MediaArtworkLookupOutcome> => {
  if (
    request.seasonNumber === undefined ||
    request.episodeNumber === undefined
  ) {
    return emptyOutcome
  }
  const search = await searchTvSelectingByTitle(
    adapter,
    request.title,
    request.year
  )
  if (search.kind !== "success") {
    return failedOutcome
  }
  const searchResults = search.value ?? []
  const show = selectBestSearchResult(request.title, searchResults)
  if (!show) {
    const subtitleSeason = await lookupSubtitleSeasonArtwork({
      adapter,
      title: request.title,
      results: searchResults,
      options: {
        episodeNumber: request.episodeNumber,
        episodeGroupNumber: request.seasonNumber,
      },
    })
    return subtitleSeason
      ? {
          status: "resolved",
          result: {
            ...subtitleSeason,
            candidates: toCandidates("tv", searchResults),
          },
        }
      : toEmptyOutcome("tv", searchResults)
  }
  const episode = await adapter.getTvEpisodeDetails({
    providerId: show.providerId,
    seasonNumber: request.seasonNumber,
    episodeNumber: request.episodeNumber,
  })
  const episodeMetadata = episode.kind === "success" ? episode.value : undefined
  return {
    status: "resolved",
    result: {
      posterPath: show.posterPath,
      stillPath: episodeMetadata?.stillPath,
      episodeTitle: episodeMetadata?.title,
      identity: toIdentity(show),
      candidates: toCandidates("tv", searchResults),
    },
  }
}

const lookupSeasonArtwork = async (
  adapter: TmdbAdapter,
  request: MediaArtworkLookupRequest
): Promise<MediaArtworkLookupOutcome> => {
  if (request.seasonNumber === undefined) {
    return emptyOutcome
  }
  const search = await searchTvSelectingByTitle(
    adapter,
    request.title,
    request.year
  )
  if (search.kind !== "success") {
    return failedOutcome
  }
  const searchResults = search.value ?? []
  const show = selectBestSearchResult(request.title, searchResults)
  if (!show) {
    const subtitleSeason = await lookupSubtitleSeasonArtwork({
      adapter,
      title: request.title,
      results: searchResults,
    })
    return subtitleSeason
      ? {
          status: "resolved",
          result: {
            ...subtitleSeason,
            candidates: toCandidates("tv", searchResults),
          },
        }
      : toEmptyOutcome("tv", searchResults)
  }
  const season = await adapter.getTvSeasonDetails(
    show.providerId,
    request.seasonNumber
  )
  const seasonPosterPath =
    season.kind === "success" ? season.value?.posterPath : undefined
  return {
    status: "resolved",
    result: {
      posterPath: seasonPosterPath ?? show.posterPath,
      identity: toIdentity(show),
      candidates: toCandidates("tv", searchResults),
    },
  }
}

const lookupTvArtwork = async (
  adapter: TmdbAdapter,
  request: MediaArtworkLookupRequest
): Promise<MediaArtworkLookupOutcome> => {
  const search = await searchTvSelectingByTitle(
    adapter,
    request.title,
    request.year
  )
  if (search.kind !== "success") {
    return failedOutcome
  }
  const searchResults = search.value ?? []
  const show = selectBestSearchResult(request.title, searchResults)
  if (show) {
    return {
      status: "resolved",
      result: {
        posterPath: show.posterPath,
        identity: toIdentity(show),
        candidates: toCandidates("tv", searchResults),
      },
    }
  }
  const subtitleSeason = await lookupSubtitleSeasonArtwork({
    adapter,
    title: request.title,
    results: searchResults,
  })
  return subtitleSeason
    ? {
        status: "resolved",
        result: {
          ...subtitleSeason,
          candidates: toCandidates("tv", searchResults),
        },
      }
    : toEmptyOutcome("tv", searchResults)
}

const lookupMovieArtwork = async (
  adapter: TmdbAdapter,
  request: MediaArtworkLookupRequest
): Promise<MediaArtworkLookupOutcome> => {
  const search = await searchMovieSelectingByTitle(
    adapter,
    request.title,
    request.year
  )
  if (search.kind !== "success") {
    return failedOutcome
  }
  const movie = selectBestSearchResult(request.title, search.value ?? [])
  return movie
    ? {
        status: "resolved",
        result: {
          posterPath: movie.posterPath,
          identity: toIdentity(movie),
          candidates: toCandidates("movie", search.value),
        },
      }
    : toEmptyOutcome("movie", search.value)
}

const lookupOutcome = (
  adapter: TmdbAdapter,
  request: MediaArtworkLookupRequest
): Promise<MediaArtworkLookupOutcome> => {
  if (request.providerId !== undefined) {
    return lookupArtworkById(adapter, request)
  }
  if (
    request.seasonNumber !== undefined &&
    request.episodeNumber !== undefined
  ) {
    return lookupEpisodeArtwork(adapter, request)
  }
  if (request.seasonNumber !== undefined) {
    return lookupSeasonArtwork(adapter, request)
  }
  return request.mediaKind === "tv"
    ? lookupTvArtwork(adapter, request)
    : lookupMovieArtwork(adapter, request)
}

/**
 * Failed outcomes carry a marker so the browser can skip negative-caching a
 * transient provider outage, mirroring the colo cache's own policy.
 */
export const mediaArtworkOutcomeToResult = (
  outcome: MediaArtworkLookupOutcome
): MediaArtworkLookupResult => {
  if (outcome.status === "resolved") {
    return outcome.result
  }
  if (outcome.status === "failed") {
    return { failed: true }
  }
  if (outcome.candidates) {
    return { candidates: outcome.candidates }
  }
  return {}
}

export const lookupMediaArtworkOutcomes = async (
  environment: MediaArtworkLookupEnvironment,
  requests: readonly MediaArtworkLookupRequest[],
  dependencies: MediaArtworkLookupDependencies = {
    fetch: globalThis.fetch.bind(globalThis),
  }
): Promise<readonly MediaArtworkLookupOutcome[]> => {
  const token = environment.TMDB_API_READ_ACCESS_TOKEN?.trim() || undefined
  if (!token || requests.length === 0) {
    return requests.map(() => emptyOutcome)
  }
  const adapter = createTmdbAdapter({ fetch: dependencies.fetch, token })
  return Promise.all(requests.map((request) => lookupOutcome(adapter, request)))
}

export const lookupMediaArtwork = async (
  environment: MediaArtworkLookupEnvironment,
  requests: readonly MediaArtworkLookupRequest[],
  dependencies: MediaArtworkLookupDependencies = {
    fetch: globalThis.fetch.bind(globalThis),
  }
): Promise<readonly MediaArtworkLookupResult[]> => {
  const outcomes = await lookupMediaArtworkOutcomes(
    environment,
    requests,
    dependencies
  )
  return outcomes.map(mediaArtworkOutcomeToResult)
}

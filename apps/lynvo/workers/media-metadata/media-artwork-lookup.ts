import type {
  MediaArtworkCandidate,
  MediaArtworkIdentity,
  MediaArtworkRequest,
  MediaArtworkResult,
} from "../../shared/api-contracts"
import {
  doesSeasonNameCoverRemainder,
  scoreSearchResultTitle,
  selectBestSearchResult,
  selectLeadingTitleMatch,
} from "./search-result-selection"
import {
  createTmdbAdapter,
  type TmdbAdapter,
  type TmdbAdapterResult,
  type TmdbSearchResult,
} from "./tmdb-adapter"

export type MediaArtworkLookupOutcome =
  | { status: "resolved"; result: MediaArtworkResult }
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
    ? results.slice(0, 5).map((result) =>
        Object.assign({}, toIdentity(result), {
          mediaKind,
          posterPath: result.posterPath,
        })
      )
    : undefined

/**
 * Identity-resolved lookups fetch by immutable provider id, so the result
 * cannot belong to a different work; the matching step does not run.
 */
const lookupArtworkById = async (
  adapter: TmdbAdapter,
  request: MediaArtworkRequest
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
      genres: details.value.genres,
      contentRating: details.value.contentRating,
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

// A year-filtered search may only surface a fuzzy title match: season packs
// stamp the season's year, not the show's premiere year, so the filter hides
// the real work and a token-subset title slides through ("The Bear" year 2024
// matches "The Hungry Games: Alaska's Big Bear Challenge" instead of the
// 2022 show). Only a strong title match (exact or leading) settles without an
// unfiltered pass, which then wins whenever its title matches better.
const STRONG_TITLE_MATCH_SCORE = 0.9

interface TmdbSearchResponse {
  readonly kind: "success"
  readonly value: readonly TmdbSearchResult[]
}

interface TitleSearchRequest {
  readonly title: string
  readonly year?: number
  readonly requireExactTitleMatch?: boolean
}

interface SearchResponseSelection {
  readonly title: string
  readonly filteredSearch: TmdbSearchResponse | undefined
  readonly unfilteredSearch: TmdbSearchResponse
  readonly requireExactTitleMatch?: boolean
}

const selectSearchResponseByTitle = ({
  title,
  filteredSearch,
  unfilteredSearch,
  requireExactTitleMatch = false,
}: SearchResponseSelection): TmdbSearchResponse => {
  if (!filteredSearch) {
    return unfilteredSearch
  }
  const selectionOptions = { requireExactTitleMatch }
  const filteredBest = selectBestSearchResult(
    title,
    filteredSearch.value,
    selectionOptions
  )
  const unfilteredBest = selectBestSearchResult(
    title,
    unfilteredSearch.value,
    selectionOptions
  )
  const filteredScore = filteredBest
    ? scoreSearchResultTitle(title, filteredBest)
    : 0
  const unfilteredScore = unfilteredBest
    ? scoreSearchResultTitle(title, unfilteredBest)
    : 0
  return unfilteredScore > filteredScore ? unfilteredSearch : filteredSearch
}

const searchSelectingByTitle = async (
  search: (
    title: string,
    year?: number
  ) => Promise<TmdbAdapterResult<readonly TmdbSearchResult[]>>,
  searchRequest: TitleSearchRequest
): Promise<TmdbAdapterResult<readonly TmdbSearchResult[]>> => {
  const { title, year, requireExactTitleMatch } = searchRequest
  const selectionOptions = { requireExactTitleMatch }
  const filteredSearch =
    year === undefined ? undefined : await search(title, year)
  if (filteredSearch && filteredSearch.kind !== "success") {
    return filteredSearch
  }
  if (filteredSearch) {
    const filteredBest = selectBestSearchResult(
      title,
      filteredSearch.value ?? [],
      selectionOptions
    )
    if (
      filteredBest &&
      scoreSearchResultTitle(title, filteredBest) >= STRONG_TITLE_MATCH_SCORE
    ) {
      return filteredSearch
    }
  }
  const unfilteredSearch = await search(title)
  if (unfilteredSearch.kind !== "success" || !filteredSearch) {
    return unfilteredSearch
  }
  return selectSearchResponseByTitle({
    title,
    filteredSearch,
    unfilteredSearch,
    requireExactTitleMatch,
  })
}

const searchTvSelectingByTitle = (
  adapter: TmdbAdapter,
  searchRequest: TitleSearchRequest
) => searchSelectingByTitle(adapter.searchTv, searchRequest)

const searchMovieSelectingByTitle = (
  adapter: TmdbAdapter,
  title: string,
  year: number | undefined
) => searchSelectingByTitle(adapter.searchMovie, { title, year })

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

type EpisodeSeasonResolution =
  | { readonly kind: "season"; readonly seasonNumber: number }
  | { readonly kind: "show-only" }
  | { readonly kind: "failed" }

const resolveEpisodeSeason = async (
  adapter: TmdbAdapter,
  show: TmdbSearchResult,
  requestedSeasonNumber: number | undefined
): Promise<EpisodeSeasonResolution> => {
  if (requestedSeasonNumber !== undefined) {
    return { kind: "season", seasonNumber: requestedSeasonNumber }
  }
  const seasonList = await adapter.getTvSeasonList(show.providerId)
  if (seasonList.kind !== "success") {
    return seasonList.kind === "failure" &&
      seasonList.failureKind === "permanent"
      ? { kind: "show-only" }
      : { kind: "failed" }
  }
  const regularSeasonNumbers = seasonList.value
    .filter((season) => season.seasonNumber > 0)
    .map((season) => season.seasonNumber)
  const [onlyRegularSeasonNumber] = regularSeasonNumbers
  return regularSeasonNumbers.length === 1 &&
    onlyRegularSeasonNumber !== undefined
    ? { kind: "season", seasonNumber: onlyRegularSeasonNumber }
    : { kind: "show-only" }
}

const toShowPosterOutcome = (
  show: TmdbSearchResult,
  searchResults: readonly TmdbSearchResult[]
): MediaArtworkLookupOutcome => ({
  status: "resolved",
  result: {
    posterPath: show.posterPath,
    identity: toIdentity(show),
    candidates: toCandidates("tv", searchResults),
  },
})

const lookupEpisodeArtworkWithoutSelectedShow = async ({
  adapter,
  request,
  episodeNumber,
  searchResults,
}: {
  readonly adapter: TmdbAdapter
  readonly request: MediaArtworkRequest
  readonly episodeNumber: number
  readonly searchResults: readonly TmdbSearchResult[]
}): Promise<MediaArtworkLookupOutcome> => {
  const subtitleSeason = await lookupSubtitleSeasonArtwork({
    adapter,
    title: request.title,
    results: searchResults,
    options: {
      episodeNumber,
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

const lookupEpisodeArtwork = async (
  adapter: TmdbAdapter,
  request: MediaArtworkRequest
): Promise<MediaArtworkLookupOutcome> => {
  const { episodeNumber } = request
  if (episodeNumber === undefined) {
    return emptyOutcome
  }
  const search = await searchTvSelectingByTitle(adapter, {
    title: request.title,
    year: request.year,
  })
  if (search.kind !== "success") {
    return failedOutcome
  }
  const searchResults = search.value ?? []
  const show = selectBestSearchResult(request.title, searchResults)
  if (!show) {
    return lookupEpisodeArtworkWithoutSelectedShow({
      adapter,
      request,
      episodeNumber,
      searchResults,
    })
  }
  const seasonResolution = await resolveEpisodeSeason(
    adapter,
    show,
    request.seasonNumber
  )
  if (seasonResolution.kind === "failed") {
    return failedOutcome
  }
  if (seasonResolution.kind === "show-only") {
    return toShowPosterOutcome(show, searchResults)
  }
  const episode = await adapter.getTvEpisodeDetails({
    providerId: show.providerId,
    seasonNumber: seasonResolution.seasonNumber,
    episodeNumber,
  })
  if (episode.kind === "failure" && episode.failureKind !== "permanent") {
    return failedOutcome
  }
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

interface WorkLevelDetailsRequest {
  readonly adapter: TmdbAdapter
  readonly mediaKind: "movie" | "tv"
  readonly providerId: number
}

/**
 * Season and poster results borrow the work-level genre list and content
 * certification from the movie/show details so detail surfaces can render
 * them under the poster. A failed details pass keeps the poster-only result.
 */
const withWorkLevelDetails = async (
  { adapter, mediaKind, providerId }: WorkLevelDetailsRequest,
  result: MediaArtworkResult
): Promise<MediaArtworkResult> => {
  const details =
    mediaKind === "movie"
      ? await adapter.getMovieDetails(providerId)
      : await adapter.getTvDetails(providerId)
  if (details.kind !== "success" || !details.value) {
    return result
  }
  return {
    ...result,
    genres: details.value.genres,
    contentRating: details.value.contentRating,
  }
}

const lookupSeasonArtwork = async (
  adapter: TmdbAdapter,
  request: MediaArtworkRequest
): Promise<MediaArtworkLookupOutcome> => {
  if (request.seasonNumber === undefined) {
    return emptyOutcome
  }
  const search = await searchTvSelectingByTitle(adapter, {
    title: request.title,
    year: request.year,
  })
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
    result: await withWorkLevelDetails(
      { adapter, mediaKind: "tv", providerId: show.providerId },
      {
        posterPath: seasonPosterPath ?? show.posterPath,
        identity: toIdentity(show),
        candidates: toCandidates("tv", searchResults),
      }
    ),
  }
}

const lookupTvArtwork = async (
  adapter: TmdbAdapter,
  request: MediaArtworkRequest
): Promise<MediaArtworkLookupOutcome> => {
  const search = await searchTvSelectingByTitle(adapter, {
    title: request.title,
    year: request.year,
    requireExactTitleMatch: request.requireExactTitleMatch,
  })
  if (search.kind !== "success") {
    return failedOutcome
  }
  const searchResults = search.value ?? []
  const show = selectBestSearchResult(request.title, searchResults, {
    requireExactTitleMatch: request.requireExactTitleMatch,
  })
  if (show) {
    return {
      status: "resolved",
      result: await withWorkLevelDetails(
        { adapter, mediaKind: "tv", providerId: show.providerId },
        {
          posterPath: show.posterPath,
          identity: toIdentity(show),
          candidates: toCandidates("tv", searchResults),
        }
      ),
    }
  }
  if (request.requireExactTitleMatch) {
    return toEmptyOutcome("tv", searchResults)
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
  request: MediaArtworkRequest
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
        result: await withWorkLevelDetails(
          { adapter, mediaKind: "movie", providerId: movie.providerId },
          {
            posterPath: movie.posterPath,
            identity: toIdentity(movie),
            candidates: toCandidates("movie", search.value),
          }
        ),
      }
    : toEmptyOutcome("movie", search.value)
}

const lookupOutcome = (
  adapter: TmdbAdapter,
  request: MediaArtworkRequest
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
  if (request.mediaKind === "tv" && request.episodeNumber !== undefined) {
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
): MediaArtworkResult => {
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
  requests: readonly MediaArtworkRequest[],
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
  requests: readonly MediaArtworkRequest[],
  dependencies: MediaArtworkLookupDependencies = {
    fetch: globalThis.fetch.bind(globalThis),
  }
): Promise<readonly MediaArtworkResult[]> => {
  const outcomes = await lookupMediaArtworkOutcomes(
    environment,
    requests,
    dependencies
  )
  return outcomes.map(mediaArtworkOutcomeToResult)
}

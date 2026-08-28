import { createTmdbAdapter, type TmdbAdapter } from "./tmdb-adapter"

interface MediaArtworkLookupRequest {
  readonly title: string
  readonly mediaKind?: "movie" | "tv"
  readonly year?: number
  readonly seasonNumber?: number
  readonly episodeNumber?: number
}

interface MediaArtworkLookupResult {
  readonly posterPath?: string
  readonly stillPath?: string
}

export type MediaArtworkLookupOutcome =
  | { status: "resolved"; result: MediaArtworkLookupResult }
  | { status: "empty" }
  | { status: "failed" }

interface MediaArtworkLookupEnvironment {
  readonly TMDB_API_READ_ACCESS_TOKEN?: string
}

interface MediaArtworkLookupDependencies {
  readonly fetch: typeof globalThis.fetch
}

const failedOutcome: MediaArtworkLookupOutcome = { status: "failed" }
const emptyOutcome: MediaArtworkLookupOutcome = { status: "empty" }

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
  const search = await adapter.searchTv(request.title, request.year)
  if (search.kind !== "success") {
    return failedOutcome
  }
  if (!search.value || search.value.length === 0) {
    return emptyOutcome
  }
  const show = search.value[0]
  const episode = await adapter.getTvEpisodeDetails(
    show.providerId,
    request.seasonNumber,
    request.episodeNumber
  )
  const stillPath =
    episode.kind === "success" ? episode.value?.stillPath : undefined
  return {
    status: "resolved",
    result: {
      posterPath: show.posterPath,
      stillPath: stillPath ?? undefined,
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
  const search = await adapter.searchTv(request.title, request.year)
  if (search.kind !== "success") {
    return failedOutcome
  }
  if (!search.value || search.value.length === 0) {
    return emptyOutcome
  }
  const show = search.value[0]
  const season = await adapter.getTvSeasonDetails(
    show.providerId,
    request.seasonNumber
  )
  const seasonPosterPath =
    season.kind === "success" ? season.value?.posterPath : undefined
  return {
    status: "resolved",
    result: { posterPath: seasonPosterPath ?? show.posterPath },
  }
}

const lookupTvArtwork = async (
  adapter: TmdbAdapter,
  request: MediaArtworkLookupRequest
): Promise<MediaArtworkLookupOutcome> => {
  const search = await adapter.searchTv(request.title, request.year)
  if (search.kind !== "success") {
    return failedOutcome
  }
  if (!search.value || search.value.length === 0) {
    return emptyOutcome
  }
  return {
    status: "resolved",
    result: { posterPath: search.value[0].posterPath },
  }
}

const lookupMovieArtwork = async (
  adapter: TmdbAdapter,
  request: MediaArtworkLookupRequest
): Promise<MediaArtworkLookupOutcome> => {
  const search = await adapter.searchMovie(request.title, request.year)
  if (search.kind !== "success") {
    return failedOutcome
  }
  if (!search.value || search.value.length === 0) {
    return emptyOutcome
  }
  return {
    status: "resolved",
    result: { posterPath: search.value[0].posterPath },
  }
}

const lookupOutcome = (
  adapter: TmdbAdapter,
  request: MediaArtworkLookupRequest
): Promise<MediaArtworkLookupOutcome> => {
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

const outcomeToResult = (
  outcome: MediaArtworkLookupOutcome
): MediaArtworkLookupResult =>
  outcome.status === "resolved" ? outcome.result : {}

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
  return outcomes.map(outcomeToResult)
}

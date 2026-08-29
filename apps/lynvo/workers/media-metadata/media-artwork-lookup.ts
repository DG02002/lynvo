import { createTmdbAdapter, type TmdbAdapter } from "./tmdb-adapter"
import { selectBestSearchResult } from "./search-result-selection"
import type { TmdbSearchResult } from "./tmdb-adapter"

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
  const show = selectBestSearchResult(request.title, search.value ?? [])
  if (!show) {
    return toEmptyOutcome("tv", search.value)
  }
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
      identity: toIdentity(show),
      candidates: toCandidates("tv", search.value),
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
  const show = selectBestSearchResult(request.title, search.value ?? [])
  if (!show) {
    return toEmptyOutcome("tv", search.value)
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
      candidates: toCandidates("tv", search.value),
    },
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
  const show = selectBestSearchResult(request.title, search.value ?? [])
  return show
    ? {
        status: "resolved",
        result: {
          posterPath: show.posterPath,
          identity: toIdentity(show),
          candidates: toCandidates("tv", search.value),
        },
      }
    : toEmptyOutcome("tv", search.value)
}

const lookupMovieArtwork = async (
  adapter: TmdbAdapter,
  request: MediaArtworkLookupRequest
): Promise<MediaArtworkLookupOutcome> => {
  const search = await adapter.searchMovie(request.title, request.year)
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
): MediaArtworkLookupResult =>
  outcome.status === "resolved"
    ? outcome.result
    : outcome.status === "empty"
      ? outcome.candidates
        ? { candidates: outcome.candidates }
        : {}
      : { failed: true }

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

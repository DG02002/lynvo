import { Result, Schema } from "effect"
import {
  MEDIA_METADATA_REQUEST_ATTEMPTS,
  MEDIA_METADATA_REQUEST_RETRY_DELAY_MS,
  MEDIA_METADATA_REQUEST_TIMEOUT_MS,
  SECOND_MS,
} from "../constants"

const TMDB_API_BASE_URL = "https://api.themoviedb.org/3"
const TMDB_ATTRIBUTION = "TMDB"

interface TmdbSearchPayload {
  readonly results?: readonly TmdbSearchPayloadItem[]
}

interface TmdbSearchPayloadItem {
  readonly id?: number
  readonly title?: string
  readonly name?: string
  readonly release_date?: string
  readonly first_air_date?: string
  readonly poster_path?: string | null
  readonly overview?: string
}

interface TmdbDetailsPayload {
  readonly id?: number
  readonly title?: string
  readonly name?: string
  readonly overview?: string
  readonly release_date?: string
  readonly first_air_date?: string
  readonly poster_path?: string | null
  readonly backdrop_path?: string | null
  readonly still_path?: string | null
  readonly season_number?: number
  readonly episode_number?: number
}

interface TmdbEpisodeGroupListPayload {
  readonly results?: readonly {
    readonly id?: string
    readonly name?: string
  }[]
}

interface TmdbEpisodeGroupPayload {
  readonly groups?: readonly {
    readonly name?: string
    readonly order?: number
    readonly episodes?: readonly (TmdbDetailsPayload & {
      readonly order?: number
    })[]
  }[]
}

export interface TmdbSearchResult {
  readonly providerId: number
  readonly title: string
  readonly year?: number
  readonly posterPath?: string
  readonly overview?: string
}

export interface TmdbMediaMetadata {
  readonly kind: "movie" | "tv" | "season" | "episode"
  readonly providerId: number
  readonly title: string
  readonly overview?: string
  readonly year?: number
  readonly posterPath?: string
  readonly backdropPath?: string
  readonly stillPath?: string
  readonly seasonNumber?: number
  readonly episodeNumber?: number
  readonly attribution: "TMDB"
}

export interface TmdbAdapterSuccess<Value> {
  readonly kind: "success"
  readonly value: Value
}

export interface TmdbAdapterFailure {
  readonly kind: "failure"
  readonly failureKind: "rate-limited" | "retryable" | "permanent"
  readonly message: string
  readonly retryAt?: number
}

export interface TmdbAdapterDisabled {
  readonly kind: "disabled"
  readonly message: string
}

export interface TmdbAdapterDependencies {
  readonly fetch: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>
  readonly token?: string
  readonly now?: () => number
  readonly timeoutMs?: number
  readonly sleep?: (delayMs: number) => Promise<void>
}

export interface TmdbAdapter {
  readonly searchMovie: (
    title: string,
    year?: number
  ) => Promise<TmdbAdapterResult<readonly TmdbSearchResult[]>>
  readonly searchTv: (
    title: string,
    year?: number
  ) => Promise<TmdbAdapterResult<readonly TmdbSearchResult[]>>
  readonly getMovieDetails: (
    providerId: number
  ) => Promise<TmdbAdapterResult<TmdbMediaMetadata>>
  readonly getTvDetails: (
    providerId: number
  ) => Promise<TmdbAdapterResult<TmdbMediaMetadata>>
  readonly getTvSeasonDetails: (
    providerId: number,
    seasonNumber: number
  ) => Promise<TmdbAdapterResult<TmdbMediaMetadata>>
  readonly getTvEpisodeDetails: (
    providerId: number,
    seasonNumber: number,
    episodeNumber: number
  ) => Promise<TmdbAdapterResult<TmdbMediaMetadata>>
}

export interface TmdbAdapterResult<Value> {
  readonly kind: "success" | "disabled" | "failure"
  readonly value?: Value
  readonly failureKind?: TmdbAdapterFailure["failureKind"]
  readonly message?: string
  readonly retryAt?: number
}

const searchPayloadSchema = Schema.Struct({
  results: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.optional(Schema.Number),
        title: Schema.optional(Schema.String),
        name: Schema.optional(Schema.String),
        release_date: Schema.optional(Schema.String),
        first_air_date: Schema.optional(Schema.String),
        poster_path: Schema.optional(Schema.NullOr(Schema.String)),
        overview: Schema.optional(Schema.String),
      })
    )
  ),
})

const detailsPayloadSchema = Schema.Struct({
  id: Schema.optional(Schema.Number),
  title: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  overview: Schema.optional(Schema.String),
  release_date: Schema.optional(Schema.String),
  first_air_date: Schema.optional(Schema.String),
  poster_path: Schema.optional(Schema.NullOr(Schema.String)),
  backdrop_path: Schema.optional(Schema.NullOr(Schema.String)),
  still_path: Schema.optional(Schema.NullOr(Schema.String)),
  season_number: Schema.optional(Schema.Number),
  episode_number: Schema.optional(Schema.Number),
})

const episodeGroupListPayloadSchema = Schema.Struct({
  results: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.optional(Schema.String),
        name: Schema.optional(Schema.String),
      })
    )
  ),
})

const episodeGroupPayloadSchema = Schema.Struct({
  groups: Schema.optional(
    Schema.Array(
      Schema.Struct({
        name: Schema.optional(Schema.String),
        order: Schema.optional(Schema.Number),
        episodes: Schema.optional(
          Schema.Array(
            Schema.Struct({
              ...detailsPayloadSchema.fields,
              order: Schema.optional(Schema.Number),
            })
          )
        ),
      })
    )
  ),
})

const errorPayloadSchema = Schema.Struct({
  status_message: Schema.optional(Schema.String),
})

const getYear = (date: string | undefined): number | undefined => {
  const year = date?.slice(0, 4)
  if (!year || !/^\d{4}$/.test(year)) {
    return undefined
  }
  return Number(year)
}

const getErrorMessage = async (response: Response): Promise<string> => {
  const payload = await response.json().catch(() => null)
  const parsed = Schema.decodeUnknownResult(errorPayloadSchema)(payload)
  return Result.isSuccess(parsed) && parsed.success.status_message
    ? parsed.success.status_message
    : `TMDB request failed with status ${response.status}`
}

const getRetryAt = (
  response: Response,
  now: () => number
): number | undefined => {
  const retryAfter = response.headers.get("Retry-After")
  if (!retryAfter) {
    return undefined
  }
  const seconds = Number(retryAfter)
  if (Number.isFinite(seconds)) {
    return now() + Math.max(0, seconds) * SECOND_MS
  }
  const retryAt = Date.parse(retryAfter)
  return Number.isNaN(retryAt) ? undefined : retryAt
}

const toSearchResult = (
  item: TmdbSearchPayloadItem
): TmdbSearchResult | undefined => {
  if (!item.id || item.id <= 0) {
    return undefined
  }
  const title = (item.title ?? item.name)?.trim()
  if (!title) {
    return undefined
  }
  const posterPath = item.poster_path ?? undefined
  return {
    providerId: item.id,
    title,
    year: getYear(item.release_date ?? item.first_air_date),
    posterPath,
    overview: item.overview?.trim() || undefined,
  }
}

const toMediaMetadata = (
  payload: TmdbDetailsPayload,
  kind: TmdbMediaMetadata["kind"],
  fallbackProviderId: number
): TmdbMediaMetadata | undefined => {
  const providerId = payload.id ?? fallbackProviderId
  const title = (payload.title ?? payload.name)?.trim()
  if (!providerId || providerId <= 0 || !title) {
    return undefined
  }
  return {
    kind,
    providerId,
    title,
    overview: payload.overview?.trim() || undefined,
    year: getYear(payload.release_date ?? payload.first_air_date),
    posterPath: payload.poster_path ?? undefined,
    backdropPath: payload.backdrop_path ?? undefined,
    stillPath: payload.still_path ?? undefined,
    seasonNumber: payload.season_number,
    episodeNumber: payload.episode_number,
    attribution: TMDB_ATTRIBUTION,
  }
}

const createDisabledResult = <Value>(): TmdbAdapterResult<Value> => ({
  kind: "disabled",
  message: "TMDB metadata is disabled",
})

export const createTmdbAdapter = (
  dependencies: TmdbAdapterDependencies
): TmdbAdapter => {
  const now = dependencies.now ?? Date.now
  const timeoutMs = dependencies.timeoutMs ?? MEDIA_METADATA_REQUEST_TIMEOUT_MS
  const token = dependencies.token?.trim()
  const sleep =
    dependencies.sleep ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, delayMs)))

  const fetchWithRetries = async (path: string): Promise<Response> => {
    let lastError: unknown
    for (
      let attempt = 1;
      attempt <= MEDIA_METADATA_REQUEST_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await dependencies.fetch(`${TMDB_API_BASE_URL}${path}`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            "User-Agent": "Lynvo/1.0",
          },
          signal: AbortSignal.timeout?.(timeoutMs),
        })
      } catch (error) {
        lastError = error
        if (attempt < MEDIA_METADATA_REQUEST_ATTEMPTS) {
          await sleep(MEDIA_METADATA_REQUEST_RETRY_DELAY_MS)
        }
      }
    }
    throw lastError
  }

  const requestJson = async <Value>(
    path: string,
    schema: Schema.Codec<Value>
  ): Promise<TmdbAdapterResult<Value>> => {
    if (!token) {
      return createDisabledResult()
    }
    let response: Response
    try {
      response = await fetchWithRetries(path)
    } catch (error) {
      return {
        kind: "failure",
        failureKind: "retryable",
        message: error instanceof Error ? error.message : "TMDB request failed",
      }
    }
    if (!response.ok) {
      const message = await getErrorMessage(response)
      if (response.status === 429) {
        return {
          kind: "failure",
          failureKind: "rate-limited",
          message,
          retryAt: getRetryAt(response, now),
        }
      }
      return {
        kind: "failure",
        failureKind:
          response.status >= 500 || response.status === 408
            ? "retryable"
            : "permanent",
        message,
      }
    }
    const payload = await response.json().catch(() => null)
    const parsed = Schema.decodeUnknownResult(schema)(payload)
    if (Result.isFailure(parsed)) {
      return {
        kind: "failure",
        failureKind: "permanent",
        message: "TMDB returned an unexpected response",
      }
    }
    return { kind: "success", value: parsed.success }
  }

  const search = async (
    endpoint: "movie" | "tv",
    title: string,
    year?: number
  ): Promise<TmdbAdapterResult<readonly TmdbSearchResult[]>> => {
    const query = new URLSearchParams({ query: title })
    if (year) {
      query.set(
        endpoint === "movie" ? "year" : "first_air_date_year",
        String(year)
      )
    }
    const response = await requestJson<TmdbSearchPayload>(
      `/search/${endpoint}?${query.toString()}`,
      searchPayloadSchema
    )
    if (response.kind === "disabled") {
      return { kind: "disabled", message: response.message }
    }
    if (response.kind === "failure") {
      return {
        kind: "failure",
        failureKind: response.failureKind,
        message: response.message,
        retryAt: response.retryAt,
      }
    }
    if (!response.value) {
      return {
        kind: "failure",
        failureKind: "permanent",
        message: "TMDB returned an empty search response",
      }
    }
    return {
      kind: "success",
      value: (response.value.results ?? []).flatMap((item) => {
        const result = toSearchResult(item)
        return result ? [result] : []
      }),
    }
  }

  const details = async (
    path: string,
    kind: TmdbMediaMetadata["kind"],
    providerId: number
  ): Promise<TmdbAdapterResult<TmdbMediaMetadata>> => {
    const response = await requestJson<TmdbDetailsPayload>(
      path,
      detailsPayloadSchema
    )
    if (response.kind === "disabled") {
      return { kind: "disabled", message: response.message }
    }
    if (response.kind === "failure") {
      return {
        kind: "failure",
        failureKind: response.failureKind,
        message: response.message,
        retryAt: response.retryAt,
      }
    }
    if (!response.value) {
      return {
        kind: "failure",
        failureKind: "permanent",
        message: "TMDB returned an empty details response",
      }
    }
    const value = toMediaMetadata(response.value, kind, providerId)
    return value
      ? { kind: "success", value }
      : {
          kind: "failure",
          failureKind: "permanent",
          message: "TMDB returned incomplete metadata",
        }
  }

  const alternativeEpisodeDetails = async (
    providerId: number,
    partNumber: number,
    episodeNumber: number
  ): Promise<TmdbAdapterResult<TmdbMediaMetadata>> => {
    const groupList = await requestJson<TmdbEpisodeGroupListPayload>(
      `/tv/${providerId}/episode_groups`,
      episodeGroupListPayloadSchema
    )
    if (groupList.kind !== "success" || !groupList.value) {
      return groupList.kind === "disabled"
        ? { kind: "disabled", message: groupList.message }
        : {
            kind: "failure",
            failureKind: groupList.failureKind ?? "permanent",
            message: groupList.message ?? "TMDB episode groups are unavailable",
            retryAt: groupList.retryAt,
          }
    }
    const partsGroup = (groupList.value.results ?? []).find(
      (group) => group.id && group.name?.trim().toLocaleLowerCase() === "parts"
    )
    if (!partsGroup?.id) {
      return {
        kind: "failure",
        failureKind: "permanent",
        message: "TMDB returned no matching episode group",
      }
    }
    const episodeGroups = await requestJson<TmdbEpisodeGroupPayload>(
      `/tv/episode_group/${partsGroup.id}`,
      episodeGroupPayloadSchema
    )
    if (episodeGroups.kind !== "success" || !episodeGroups.value) {
      return episodeGroups.kind === "disabled"
        ? { kind: "disabled", message: episodeGroups.message }
        : {
            kind: "failure",
            failureKind: episodeGroups.failureKind ?? "permanent",
            message:
              episodeGroups.message ?? "TMDB episode group is unavailable",
            retryAt: episodeGroups.retryAt,
          }
    }
    const part = (episodeGroups.value.groups ?? []).find(
      (group) =>
        group.order === partNumber ||
        group.name?.trim().toLocaleLowerCase() === `part ${partNumber}`
    )
    const episode = (part?.episodes ?? []).find(
      (candidate) => candidate.order === episodeNumber - 1
    )
    const metadata = episode
      ? toMediaMetadata(episode, "episode", providerId)
      : undefined
    return metadata
      ? {
          kind: "success",
          value: {
            ...metadata,
            seasonNumber: partNumber,
            episodeNumber,
          },
        }
      : {
          kind: "failure",
          failureKind: "permanent",
          message: "TMDB returned no matching episode group entry",
        }
  }

  const episodeDetails = async (
    providerId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<TmdbAdapterResult<TmdbMediaMetadata>> => {
    const canonical = await details(
      `/tv/${providerId}/season/${seasonNumber}/episode/${episodeNumber}`,
      "episode",
      providerId
    )
    return canonical.kind === "failure" && canonical.failureKind === "permanent"
      ? alternativeEpisodeDetails(providerId, seasonNumber, episodeNumber)
      : canonical
  }

  return {
    searchMovie: (title, year) => search("movie", title, year),
    searchTv: (title, year) => search("tv", title, year),
    getMovieDetails: (providerId) =>
      details(`/movie/${providerId}`, "movie", providerId),
    getTvDetails: (providerId) =>
      details(`/tv/${providerId}`, "tv", providerId),
    getTvSeasonDetails: (providerId, seasonNumber) =>
      details(`/tv/${providerId}/season/${seasonNumber}`, "season", providerId),
    getTvEpisodeDetails: episodeDetails,
  }
}

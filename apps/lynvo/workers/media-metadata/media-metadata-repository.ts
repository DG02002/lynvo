import {
  DAY_MS,
  MEDIA_METADATA_ACCOUNT_DAILY_REQUEST_LIMIT,
  MEDIA_METADATA_ACCOUNT_JOB_LIMIT,
  MEDIA_METADATA_CACHE_TTL_MS,
  MEDIA_METADATA_GLOBAL_JOB_LIMIT,
  MEDIA_METADATA_GLOBAL_DAILY_REQUEST_LIMIT,
  MEDIA_METADATA_JOB_LEASE_MS,
  MEDIA_METADATA_MAX_ATTEMPTS,
  MEDIA_METADATA_RETRY_BASE_DELAY_MS,
  MEDIA_METADATA_RETRY_MAX_DELAY_MS,
  MEDIA_METADATA_RETRY_JITTER_RATIO,
  MEDIA_METADATA_RESOLVER_VERSION,
} from "../constants"
import { Result, Schema } from "effect"
import type { TmdbMediaMetadata } from "./tmdb-adapter"
import { createOpaqueId } from "../d1/ids"

export interface MediaMetadataCacheRecord {
  readonly id: string
  readonly cacheKey: string
  readonly provider: string
  readonly mediaKind: "movie" | "tv" | "season" | "episode"
  readonly providerId?: string
  readonly seasonNumber?: number
  readonly episodeNumber?: number
  readonly payload: TmdbMediaMetadata
  readonly attribution: string
  readonly fetchedAt: number
  readonly expiresAt: number
  readonly updatedAt: number
}

export interface MediaMetadataJobInput {
  readonly jobKey: string
  readonly requestedUserId?: string
  readonly titleGroupId?: string
  readonly provider: "tmdb"
  readonly mediaKind: "movie" | "tv" | "season" | "episode"
  readonly title: string
  readonly year?: number
  readonly seasonNumber?: number
  readonly episodeNumber?: number
  readonly now: number
}

export interface MediaMetadataJob {
  readonly id: string
  readonly jobKey: string
  readonly requestedUserId?: string
  readonly titleGroupId?: string
  readonly provider: "tmdb"
  readonly mediaKind: "movie" | "tv" | "season" | "episode"
  readonly title: string
  readonly year?: number
  readonly seasonNumber?: number
  readonly episodeNumber?: number
  readonly state: "pending" | "running" | "succeeded" | "failed"
  readonly attemptCount: number
  readonly availableAt: number
  readonly leaseExpiresAt?: number
  readonly lastError?: string
  readonly createdAt: number
  readonly updatedAt: number
}

export interface MediaMetadataJobClaim extends MediaMetadataJob {
  readonly leaseExpiresAt: number
}

export const MEDIA_METADATA_JOB_KEY_PREFIX = `resolver-v${MEDIA_METADATA_RESOLVER_VERSION}:`

interface MediaMetadataCacheRow {
  readonly id: string
  readonly cache_key: string
  readonly provider: "tmdb"
  readonly media_kind: MediaMetadataCacheRecord["mediaKind"]
  readonly provider_id: string | null
  readonly season_number: number | null
  readonly episode_number: number | null
  readonly payload_json: string
  readonly attribution: string
  readonly fetched_at: number
  readonly expires_at: number
  readonly updated_at: number
}

interface MediaMetadataJobRow {
  readonly id: string
  readonly job_key: string
  readonly requested_user_id: string | null
  readonly title_group_id: string | null
  readonly provider: "tmdb"
  readonly media_kind: MediaMetadataJob["mediaKind"]
  readonly title: string
  readonly year: number | null
  readonly season_number: number | null
  readonly episode_number: number | null
  readonly state: MediaMetadataJob["state"]
  readonly attempt_count: number
  readonly available_at: number
  readonly lease_expires_at: number | null
  readonly last_error: string | null
  readonly created_at: number
  readonly updated_at: number
}

const metadataPayloadSchema = Schema.Struct({
  kind: Schema.Literals(["movie", "tv", "season", "episode"]),
  providerId: Schema.Number,
  title: Schema.String,
  overview: Schema.optional(Schema.String),
  year: Schema.optional(Schema.Number),
  posterPath: Schema.optional(Schema.String),
  backdropPath: Schema.optional(Schema.String),
  stillPath: Schema.optional(Schema.String),
  seasonNumber: Schema.optional(Schema.Number),
  episodeNumber: Schema.optional(Schema.Number),
  attribution: Schema.Literal("TMDB"),
})

const toCacheRecord = (
  row: MediaMetadataCacheRow
): MediaMetadataCacheRecord | null => {
  try {
    const parsed = Schema.decodeUnknownResult(metadataPayloadSchema)(
      JSON.parse(row.payload_json)
    )
    if (Result.isFailure(parsed)) {
      return null
    }
    const payload: TmdbMediaMetadata = parsed.success
    return {
      id: row.id,
      cacheKey: row.cache_key,
      provider: row.provider,
      mediaKind: row.media_kind,
      providerId: row.provider_id ?? undefined,
      seasonNumber: row.season_number ?? undefined,
      episodeNumber: row.episode_number ?? undefined,
      payload,
      attribution: row.attribution,
      fetchedAt: row.fetched_at,
      expiresAt: row.expires_at,
      updatedAt: row.updated_at,
    }
  } catch {
    return null
  }
}

const toJob = (row: MediaMetadataJobRow): MediaMetadataJob => ({
  id: row.id,
  jobKey: row.job_key,
  requestedUserId: row.requested_user_id ?? undefined,
  titleGroupId: row.title_group_id ?? undefined,
  provider: row.provider,
  mediaKind: row.media_kind,
  title: row.title,
  year: row.year ?? undefined,
  seasonNumber: row.season_number ?? undefined,
  episodeNumber: row.episode_number ?? undefined,
  state: row.state,
  attemptCount: row.attempt_count,
  availableAt: row.available_at,
  leaseExpiresAt: row.lease_expires_at ?? undefined,
  lastError: row.last_error ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const createMediaMetadataJobKey = (input: {
  readonly provider: string
  readonly mediaKind: string
  readonly title: string
  readonly year?: number
  readonly seasonNumber?: number
  readonly episodeNumber?: number
}): string =>
  `${MEDIA_METADATA_JOB_KEY_PREFIX}${[
    input.provider,
    input.mediaKind,
    input.title.trim().toLocaleLowerCase(),
    input.year ?? "",
    input.seasonNumber ?? "",
    input.episodeNumber ?? "",
  ].join(":")}`

export const getMetadataRetryDelayMs = (
  attemptCount: number,
  random = Math.random
): number => {
  const exponent = Math.max(0, attemptCount - 1)
  const baseDelay = Math.min(
    MEDIA_METADATA_RETRY_MAX_DELAY_MS,
    MEDIA_METADATA_RETRY_BASE_DELAY_MS * 2 ** exponent
  )
  const jitter = Math.round(
    baseDelay * MEDIA_METADATA_RETRY_JITTER_RATIO * random()
  )
  return Math.min(MEDIA_METADATA_RETRY_MAX_DELAY_MS, baseDelay + jitter)
}

export const readMediaMetadataCache = async (
  database: D1Database,
  cacheKey: string,
  now: number
): Promise<{
  readonly record: MediaMetadataCacheRecord
  readonly isFresh: boolean
} | null> => {
  const row = await database
    .prepare("SELECT * FROM media_metadata_cache WHERE cache_key = ?1")
    .bind(cacheKey)
    .first<MediaMetadataCacheRow>()
  const record = row ? toCacheRecord(row) : null
  if (!record) {
    return null
  }
  return { record, isFresh: record.expiresAt > now }
}

export const writeMediaMetadataCache = async (
  database: D1Database,
  input: {
    readonly cacheKey: string
    readonly provider: "tmdb"
    readonly mediaKind: MediaMetadataCacheRecord["mediaKind"]
    readonly providerId?: string
    readonly seasonNumber?: number
    readonly episodeNumber?: number
    readonly payload: TmdbMediaMetadata
    readonly attribution: string
    readonly now: number
  }
): Promise<void> => {
  await database
    .prepare(
      `INSERT INTO media_metadata_cache (id, cache_key, provider, media_kind, provider_id, season_number, episode_number, payload_json, attribution, fetched_at, expires_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
       ON CONFLICT(cache_key) DO UPDATE SET provider_id = excluded.provider_id, season_number = excluded.season_number, episode_number = excluded.episode_number, payload_json = excluded.payload_json, attribution = excluded.attribution, fetched_at = excluded.fetched_at, expires_at = excluded.expires_at, updated_at = excluded.updated_at`
    )
    .bind(
      createOpaqueId(),
      input.cacheKey,
      input.provider,
      input.mediaKind,
      input.providerId ?? null,
      input.seasonNumber ?? null,
      input.episodeNumber ?? null,
      JSON.stringify(input.payload),
      input.attribution,
      input.now,
      input.now + MEDIA_METADATA_CACHE_TTL_MS,
      input.now
    )
    .run()
}

export const enqueueMediaMetadataJob = async (
  database: D1Database,
  input: MediaMetadataJobInput
): Promise<{
  readonly inserted: boolean
  readonly requeued: boolean
}> => {
  const existingJob = await database
    .prepare("SELECT state FROM media_metadata_jobs WHERE job_key = ?1")
    .bind(input.jobKey)
    .first<{ state: MediaMetadataJob["state"] }>()
  const result = await createMediaMetadataJobStatement(database, input).run()
  return {
    inserted: (result.meta.changes ?? 0) > 0 && !existingJob,
    requeued: (result.meta.changes ?? 0) > 0 && Boolean(existingJob),
  }
}

export const createMediaMetadataJobStatement = (
  database: D1Database,
  input: MediaMetadataJobInput
): D1PreparedStatement =>
  database
    .prepare(
      `INSERT INTO media_metadata_jobs (id, job_key, requested_user_id, title_group_id, provider, media_kind, title, year, season_number, episode_number, state, attempt_count, available_at, created_at, updated_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0, ?12, ?12, ?12
       WHERE (SELECT COUNT(*) FROM media_metadata_jobs WHERE state IN ('pending', 'running')) < ?13
         AND (?3 IS NULL OR (SELECT COUNT(*) FROM media_metadata_jobs WHERE requested_user_id = ?3 AND state IN ('pending', 'running')) < ?14)
         AND (?4 IS NULL OR EXISTS (
           SELECT 1 FROM title_groups
           WHERE id = ?4 AND user_id = ?3
             AND (metadata_state = 'pending' OR ?6 IN ('season', 'episode'))
         ))
       ON CONFLICT(job_key) DO UPDATE SET requested_user_id = excluded.requested_user_id, title_group_id = excluded.title_group_id, state = 'pending', available_at = excluded.available_at, lease_expires_at = NULL, last_error = NULL, updated_at = excluded.updated_at
       WHERE media_metadata_jobs.state IN ('succeeded', 'failed')`
    )
    .bind(
      createOpaqueId(),
      input.jobKey,
      input.requestedUserId ?? null,
      input.titleGroupId ?? null,
      input.provider,
      input.mediaKind,
      input.title,
      input.year ?? null,
      input.seasonNumber ?? null,
      input.episodeNumber ?? null,
      "pending",
      input.now,
      MEDIA_METADATA_GLOBAL_JOB_LIMIT,
      MEDIA_METADATA_ACCOUNT_JOB_LIMIT
    )

export const claimNextMediaMetadataJob = async (
  database: D1Database,
  now: number
): Promise<MediaMetadataJobClaim | undefined> => {
  const row = await database
    .prepare(
      `SELECT * FROM media_metadata_jobs
       WHERE (state = 'pending' AND available_at <= ?1)
          OR (state = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?1)
       ORDER BY available_at ASC, created_at ASC LIMIT 1`
    )
    .bind(now)
    .first<MediaMetadataJobRow>()
  if (!row) {
    return undefined
  }
  const leaseExpiresAt = now + MEDIA_METADATA_JOB_LEASE_MS
  const result = await database
    .prepare(
      `UPDATE media_metadata_jobs SET state = 'running', attempt_count = attempt_count + 1, lease_expires_at = ?2, updated_at = ?3
       WHERE id = ?1 AND (state = 'pending' OR (state = 'running' AND lease_expires_at <= ?3))`
    )
    .bind(row.id, leaseExpiresAt, now)
    .run()
  if ((result.meta.changes ?? 0) === 0) {
    return undefined
  }
  return {
    ...toJob(row),
    state: "running",
    attemptCount: row.attempt_count + 1,
    leaseExpiresAt,
    updatedAt: now,
  }
}

export const settleMediaMetadataJob = async (
  database: D1Database,
  input: {
    readonly id: string
    readonly leaseExpiresAt: number
    readonly outcome: "succeeded" | "retryable" | "rate-limited" | "permanent"
    readonly error?: string
    readonly retryAt?: number
    readonly now: number
    readonly random?: () => number
  }
): Promise<boolean> => {
  const row = await database
    .prepare("SELECT * FROM media_metadata_jobs WHERE id = ?1")
    .bind(input.id)
    .first<MediaMetadataJobRow>()
  if (
    !row ||
    row.state !== "running" ||
    row.lease_expires_at !== input.leaseExpiresAt
  ) {
    return false
  }
  const shouldRetry =
    input.outcome === "retryable" || input.outcome === "rate-limited"
  const canRetry =
    shouldRetry && row.attempt_count < MEDIA_METADATA_MAX_ATTEMPTS
  const availableAt = canRetry
    ? Math.max(
        input.now,
        input.retryAt ??
          input.now + getMetadataRetryDelayMs(row.attempt_count, input.random)
      )
    : input.now
  const nextState =
    input.outcome === "succeeded"
      ? "succeeded"
      : canRetry
        ? "pending"
        : "failed"
  const result = await database
    .prepare(
      `UPDATE media_metadata_jobs SET state = ?2, available_at = ?3, lease_expires_at = NULL, last_error = ?4, updated_at = ?5
       WHERE id = ?1 AND state = 'running' AND lease_expires_at = ?6`
    )
    .bind(
      input.id,
      nextState,
      availableAt,
      input.error ?? null,
      input.now,
      input.leaseExpiresAt
    )
    .run()
  return (result.meta.changes ?? 0) > 0
}

export const reserveMediaMetadataRequest = async (
  database: D1Database,
  userId: string | undefined,
  now: number
): Promise<boolean> => {
  const cutoff = now - DAY_MS
  const result = await database
    .prepare(
      `INSERT INTO media_metadata_request_log (id, user_id, created_at)
       SELECT ?1, ?2, ?3
       WHERE (SELECT COUNT(*) FROM media_metadata_request_log WHERE created_at >= ?4) < ?5
         AND (?2 IS NULL OR (SELECT COUNT(*) FROM media_metadata_request_log WHERE user_id = ?2 AND created_at >= ?4) < ?6)`
    )
    .bind(
      createOpaqueId(),
      userId ?? null,
      now,
      cutoff,
      MEDIA_METADATA_GLOBAL_DAILY_REQUEST_LIMIT,
      MEDIA_METADATA_ACCOUNT_DAILY_REQUEST_LIMIT
    )
    .run()
  return (result.meta.changes ?? 0) > 0
}

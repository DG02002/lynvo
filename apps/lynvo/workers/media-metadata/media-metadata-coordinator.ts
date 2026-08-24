import {
  DAY_MS,
  MEDIA_METADATA_BATCH_SIZE,
  MEDIA_METADATA_CACHE_TTL_MS,
  TITLE_GROUP_RECONCILIATION_USER_BATCH_SIZE,
} from "../constants"
import { executeOwnedWrite } from "../d1/data-version"
import { notifyAccountDataChanged } from "../d1/data-version-notification"
import { reconcileMissingTitleGroups } from "../d1/title-groups"
import {
  claimNextMediaMetadataJob,
  createMediaMetadataJobKey,
  enqueueMediaMetadataJob,
  MEDIA_METADATA_JOB_KEY_PREFIX,
  readMediaMetadataCache,
  reserveMediaMetadataRequest,
  settleMediaMetadataJob,
  writeMediaMetadataCache,
  type MediaMetadataJob,
} from "./media-metadata-repository"
import {
  createTmdbAdapter,
  type TmdbAdapter,
  type TmdbAdapterResult,
  type TmdbMediaMetadata,
  type TmdbSearchResult,
} from "./tmdb-adapter"

interface TmdbEnvironment {
  readonly TMDB_API_READ_ACCESS_TOKEN?: string
}

interface PendingTitleGroupRow {
  readonly id: string
  readonly user_id: string
  readonly media_kind: "movie" | "tv-season"
  readonly display_title: string
  readonly year: number | null
  readonly season_number: number | null
  readonly metadata_state: "pending" | "available" | "unavailable" | "failed"
}

interface MetadataTargetGroupRow extends PendingTitleGroupRow {
  readonly provider_id: string | null
  readonly poster_path: string | null
  readonly backdrop_path: string | null
  readonly overview: string | null
}

interface TitleEntryMetadataRow {
  readonly id: string
  readonly kind: "movie" | "episode" | "episode-range" | "container" | "unknown"
  readonly episode_start: number | null
  readonly episode_end: number | null
}

export interface MediaMetadataMaintenanceResult {
  readonly disabled: boolean
  readonly enqueuedJobs: number
  readonly processedJobs: number
}

const getProviderToken = (environment: Env): string | undefined => {
  const environmentWithOptionalToken: Env & TmdbEnvironment = environment
  return (
    environmentWithOptionalToken.TMDB_API_READ_ACCESS_TOKEN?.trim() || undefined
  )
}

const getCacheKey = (job: MediaMetadataJob, providerId: number): string =>
  [
    job.provider,
    job.mediaKind,
    providerId,
    job.seasonNumber ?? "",
    job.episodeNumber ?? "",
  ].join(":")

const getTargetGroups = async (
  database: D1Database,
  job: MediaMetadataJob
): Promise<MetadataTargetGroupRow[]> => {
  const mediaKind = job.mediaKind === "movie" ? "movie" : "tv-season"
  const groups = await database
    .prepare(
      `SELECT id, user_id, media_kind, display_title, year, season_number, metadata_state, provider_id, poster_path, backdrop_path, overview
       FROM title_groups
       WHERE media_kind = ?1
         AND lower(display_title) = lower(?2)
         AND ((?3 IS NULL AND year IS NULL) OR (?3 IS NOT NULL AND year = ?3))
         AND ((?4 IS NULL AND season_number IS NULL) OR (?4 IS NOT NULL AND season_number = ?4))
       ORDER BY last_added_at DESC`
    )
    .bind(
      mediaKind,
      job.title,
      job.year ?? null,
      job.mediaKind === "movie" ? null : (job.seasonNumber ?? null)
    )
    .all<MetadataTargetGroupRow>()
  if (groups.results.length > 0) {
    return groups.results
  }
  if (!job.titleGroupId || !job.requestedUserId) {
    return []
  }
  const fallbackGroup = await database
    .prepare(
      "SELECT id, user_id, media_kind, display_title, year, season_number, metadata_state, provider_id, poster_path, backdrop_path, overview FROM title_groups WHERE id = ?1 AND user_id = ?2"
    )
    .bind(job.titleGroupId, job.requestedUserId)
    .first<MetadataTargetGroupRow>()
  return fallbackGroup ? [fallbackGroup] : []
}

const getSearchResult = (
  result: TmdbAdapterResult<readonly TmdbSearchResult[]>,
  job: MediaMetadataJob
): TmdbSearchResult | undefined => {
  if (result.kind !== "success") {
    return undefined
  }
  const normalizeTitle = (title: string) =>
    title
      .toLocaleLowerCase()
      .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
  const expectedTitle = normalizeTitle(job.title)
  const matches = (result.value ?? []).filter(
    (candidate) =>
      normalizeTitle(candidate.title) === expectedTitle &&
      (job.mediaKind !== "movie" ||
        job.year === undefined ||
        candidate.year === job.year)
  )
  return matches[0]
}

const getAdapterFailure = (
  result: TmdbAdapterResult<unknown>
):
  | {
      readonly outcome: "rate-limited" | "retryable" | "permanent"
      readonly message: string
      readonly retryAt?: number
    }
  | undefined => {
  if (result.kind !== "failure") {
    return undefined
  }
  return {
    outcome: result.failureKind ?? "retryable",
    message: result.message ?? "TMDB request failed",
    retryAt: result.retryAt,
  }
}

const updateGroupMetadata = async (
  database: D1Database,
  group: MetadataTargetGroupRow,
  metadata: TmdbMediaMetadata,
  now: number,
  shouldUpdateProviderIdentity: boolean
): Promise<number> => {
  const result = await executeOwnedWrite(database, group.user_id, [
    database
      .prepare(
        `UPDATE title_groups SET metadata_state = 'available', provider = COALESCE(?3, provider), provider_id = COALESCE(?4, provider_id), year = COALESCE(?5, year), poster_path = COALESCE(?6, poster_path), backdrop_path = COALESCE(?7, backdrop_path), overview = COALESCE(?8, overview), metadata_fetched_at = ?9, metadata_expires_at = ?10, updated_at = ?11 WHERE id = ?1 AND user_id = ?2`
      )
      .bind(
        group.id,
        group.user_id,
        shouldUpdateProviderIdentity ? "tmdb" : null,
        shouldUpdateProviderIdentity ? String(metadata.providerId) : null,
        metadata.year ?? null,
        metadata.posterPath ?? null,
        metadata.backdropPath ?? null,
        metadata.overview ?? null,
        now,
        now + MEDIA_METADATA_CACHE_TTL_MS,
        now
      ),
    database
      .prepare(
        "UPDATE title_entries SET metadata_state = 'available', updated_at = ?2 WHERE title_group_id = ?1 AND user_id = ?3"
      )
      .bind(group.id, now, group.user_id),
  ])
  return result.dataVersion
}

const updateEntryMetadata = async (
  database: D1Database,
  group: MetadataTargetGroupRow,
  metadata: TmdbMediaMetadata,
  now: number
): Promise<number> => {
  const entry = await database
    .prepare(
      "SELECT id, kind, episode_start, episode_end FROM title_entries WHERE user_id = ?1 AND title_group_id = ?2 AND episode_start = ?3 LIMIT 1"
    )
    .bind(group.user_id, group.id, metadata.episodeNumber ?? -1)
    .first<TitleEntryMetadataRow>()
  if (!entry) {
    return 0
  }
  return (
    await executeOwnedWrite(database, group.user_id, [
      database
        .prepare(
          "UPDATE title_entries SET metadata_state = 'available', metadata_title = COALESCE(?3, metadata_title), still_path = COALESCE(?4, still_path), updated_at = ?5 WHERE id = ?1 AND user_id = ?2"
        )
        .bind(
          entry.id,
          group.user_id,
          metadata.title,
          metadata.stillPath ?? null,
          now
        ),
    ])
  ).dataVersion
}

const notifySafely = async (
  environment: Env,
  userId: string,
  dataVersion: number
): Promise<void> => {
  try {
    await notifyAccountDataChanged(environment, userId, dataVersion)
  } catch (error) {
    console.error("Unable to notify media metadata change", error)
  }
}

const fetchCachedDetails = async (
  database: D1Database,
  adapter: TmdbAdapter,
  job: MediaMetadataJob,
  providerId: number,
  userId: string,
  now: number,
  hasReservation = false
): Promise<TmdbAdapterResult<TmdbMediaMetadata>> => {
  const cacheKey = getCacheKey(job, providerId)
  const cached = await readMediaMetadataCache(database, cacheKey, now)
  if (cached?.isFresh) {
    return { kind: "success", value: cached.record.payload }
  }
  if (
    !hasReservation &&
    !(await reserveMediaMetadataRequest(database, userId, now))
  ) {
    return {
      kind: "failure",
      failureKind: "rate-limited",
      message: "Metadata request limit reached",
      retryAt: now + DAY_MS,
    }
  }
  let result: TmdbAdapterResult<TmdbMediaMetadata>
  if (job.mediaKind === "movie") {
    result = await adapter.getMovieDetails(providerId)
  } else if (job.mediaKind === "tv") {
    result = await adapter.getTvDetails(providerId)
  } else if (job.mediaKind === "season") {
    result = await adapter.getTvSeasonDetails(providerId, job.seasonNumber ?? 0)
  } else {
    result = await adapter.getTvEpisodeDetails(
      providerId,
      job.seasonNumber ?? 0,
      job.episodeNumber ?? 0
    )
  }
  if (result.kind === "success" && result.value) {
    await writeMediaMetadataCache(database, {
      cacheKey,
      provider: "tmdb",
      mediaKind: job.mediaKind,
      providerId: String(providerId),
      seasonNumber: job.seasonNumber,
      episodeNumber: job.episodeNumber,
      payload: result.value,
      attribution: result.value.attribution,
      now,
    })
  }
  if (result.kind === "failure" && cached) {
    return { kind: "success", value: cached.record.payload }
  }
  return result
}

const enqueueFollowUpJobs = async (
  database: D1Database,
  groups: readonly MetadataTargetGroupRow[],
  now: number
): Promise<number> => {
  const group = groups[0]
  if (!group) {
    return 0
  }
  if (group.media_kind !== "tv-season") {
    return 0
  }
  const seasonJob = await enqueueMediaMetadataJob(database, {
    jobKey: createMediaMetadataJobKey({
      provider: "tmdb",
      mediaKind: "season",
      title: group.display_title,
      year: group.year ?? undefined,
      seasonNumber: group.season_number ?? undefined,
    }),
    requestedUserId: group.user_id,
    titleGroupId: group.id,
    provider: "tmdb",
    mediaKind: "season",
    title: group.display_title,
    year: group.year ?? undefined,
    seasonNumber: group.season_number ?? undefined,
    now,
  })
  const episodeNumbers = new Set<number>()
  const episodeRowsByGroup = await Promise.all(
    groups.map((targetGroup) =>
      database
        .prepare(
          "SELECT id, kind, episode_start, episode_end FROM title_entries WHERE user_id = ?1 AND title_group_id = ?2 AND kind IN ('episode', 'episode-range')"
        )
        .bind(targetGroup.user_id, targetGroup.id)
        .all<TitleEntryMetadataRow>()
    )
  )
  for (const episodeRows of episodeRowsByGroup) {
    for (const episode of episodeRows.results) {
      if (episode.episode_start !== null) {
        episodeNumbers.add(episode.episode_start)
      }
    }
  }
  let enqueuedJobs = seasonJob.inserted || seasonJob.requeued ? 1 : 0
  for (const episodeNumber of [...episodeNumbers].sort(
    (first, second) => first - second
  )) {
    const episodeJob = await enqueueMediaMetadataJob(database, {
      jobKey: createMediaMetadataJobKey({
        provider: "tmdb",
        mediaKind: "episode",
        title: group.display_title,
        year: group.year ?? undefined,
        seasonNumber: group.season_number ?? undefined,
        episodeNumber,
      }),
      requestedUserId: group.user_id,
      titleGroupId: group.id,
      provider: "tmdb",
      mediaKind: "episode",
      title: group.display_title,
      year: group.year ?? undefined,
      seasonNumber: group.season_number ?? undefined,
      episodeNumber,
      now,
    })
    if (episodeJob.inserted || episodeJob.requeued) {
      enqueuedJobs += 1
    }
  }
  return enqueuedJobs
}

const processJob = async (
  environment: Env,
  database: D1Database,
  adapter: TmdbAdapter,
  job: MediaMetadataJob,
  leaseExpiresAt: number,
  now: number
): Promise<boolean> => {
  const targetGroups = await getTargetGroups(database, job)
  const targetGroup = targetGroups[0]
  if (!targetGroup) {
    return settleMediaMetadataJob(database, {
      id: job.id,
      leaseExpiresAt,
      outcome: "permanent",
      error: "Title group no longer exists",
      now,
    })
  }
  let metadataResult: TmdbAdapterResult<TmdbMediaMetadata>
  if (job.mediaKind === "movie" || job.mediaKind === "tv") {
    if (
      !(await reserveMediaMetadataRequest(database, targetGroup.user_id, now))
    ) {
      return settleMediaMetadataJob(database, {
        id: job.id,
        leaseExpiresAt,
        outcome: "rate-limited",
        error: "Metadata request limit reached",
        retryAt: now + DAY_MS,
        now,
      })
    }
    const searchResult =
      job.mediaKind === "movie"
        ? await adapter.searchMovie(job.title, job.year)
        : await adapter.searchTv(job.title)
    const searchFailure = getAdapterFailure(searchResult)
    if (searchFailure) {
      return settleMediaMetadataJob(database, {
        id: job.id,
        leaseExpiresAt,
        outcome: searchFailure.outcome,
        error: searchFailure.message,
        retryAt: searchFailure.retryAt,
        now,
      })
    }
    const searchMatch = getSearchResult(searchResult, job)
    if (!searchMatch) {
      return settleMediaMetadataJob(database, {
        id: job.id,
        leaseExpiresAt,
        outcome: "permanent",
        error: "No matching TMDB title was found",
        now,
      })
    }
    metadataResult = await fetchCachedDetails(
      database,
      adapter,
      job,
      searchMatch.providerId,
      targetGroup.user_id,
      now,
      true
    )
  } else {
    const providerId = Number(targetGroup.provider_id)
    if (!Number.isInteger(providerId) || providerId <= 0) {
      return settleMediaMetadataJob(database, {
        id: job.id,
        leaseExpiresAt,
        outcome: "permanent",
        error: "TMDB title ID is unavailable",
        now,
      })
    }
    metadataResult = await fetchCachedDetails(
      database,
      adapter,
      job,
      providerId,
      targetGroup.user_id,
      now
    )
  }
  const failure = getAdapterFailure(metadataResult)
  if (failure) {
    return settleMediaMetadataJob(database, {
      id: job.id,
      leaseExpiresAt,
      outcome: failure.outcome,
      error: failure.message,
      retryAt: failure.retryAt,
      now,
    })
  }
  if (metadataResult.kind !== "success" || !metadataResult.value) {
    return settleMediaMetadataJob(database, {
      id: job.id,
      leaseExpiresAt,
      outcome: "permanent",
      error: "TMDB returned no metadata",
      now,
    })
  }
  const dataVersionsByUser = new Map<string, number>()
  for (const group of targetGroups) {
    const dataVersion =
      job.mediaKind === "episode"
        ? await updateEntryMetadata(database, group, metadataResult.value, now)
        : await updateGroupMetadata(
            database,
            group,
            metadataResult.value,
            now,
            job.mediaKind === "movie" || job.mediaKind === "tv"
          )
    dataVersionsByUser.set(group.user_id, dataVersion)
  }
  await Promise.all(
    [...dataVersionsByUser].map(([userId, dataVersion]) =>
      dataVersion > 0
        ? notifySafely(environment, userId, dataVersion)
        : Promise.resolve()
    )
  )
  if (job.mediaKind === "movie" || job.mediaKind === "tv") {
    await enqueueFollowUpJobs(database, targetGroups, now)
  }
  return settleMediaMetadataJob(database, {
    id: job.id,
    leaseExpiresAt,
    outcome: "succeeded",
    now,
  })
}

const markProviderUnavailable = async (
  environment: Env,
  database: D1Database,
  now: number
): Promise<void> => {
  const users = await database
    .prepare(
      "SELECT DISTINCT user_id FROM title_groups WHERE metadata_state = 'pending' AND media_kind IN ('movie', 'tv-season')"
    )
    .all<{ user_id: string }>()
  for (const user of users.results) {
    const dataVersion = (
      await executeOwnedWrite(database, user.user_id, [
        database
          .prepare(
            "UPDATE title_groups SET metadata_state = 'unavailable', updated_at = ?2 WHERE user_id = ?1 AND metadata_state = 'pending'"
          )
          .bind(user.user_id, now),
        database
          .prepare(
            "UPDATE title_entries SET metadata_state = 'unavailable', updated_at = ?2 WHERE user_id = ?1 AND metadata_state = 'pending' AND title_group_id IN (SELECT id FROM title_groups WHERE user_id = ?1 AND media_kind IN ('movie', 'tv-season'))"
          )
          .bind(user.user_id, now),
        database
          .prepare(
            "UPDATE media_metadata_jobs SET state = 'failed', last_error = 'TMDB metadata is disabled', lease_expires_at = NULL, updated_at = ?2 WHERE requested_user_id = ?1 AND state IN ('pending', 'running')"
          )
          .bind(user.user_id, now),
      ])
    ).dataVersion
    await notifySafely(environment, user.user_id, dataVersion)
  }
}

const reenableProviderGroups = async (
  environment: Env,
  database: D1Database,
  now: number
): Promise<void> => {
  const users = await database
    .prepare(
      "SELECT DISTINCT user_id FROM title_groups WHERE metadata_state = 'unavailable' AND media_kind IN ('movie', 'tv-season')"
    )
    .all<{ user_id: string }>()
  for (const user of users.results) {
    const dataVersion = (
      await executeOwnedWrite(database, user.user_id, [
        database
          .prepare(
            "UPDATE title_groups SET metadata_state = 'pending', updated_at = ?2 WHERE user_id = ?1 AND metadata_state = 'unavailable'"
          )
          .bind(user.user_id, now),
        database
          .prepare(
            "UPDATE title_entries SET metadata_state = 'pending', updated_at = ?2 WHERE user_id = ?1 AND metadata_state = 'unavailable' AND title_group_id IN (SELECT id FROM title_groups WHERE user_id = ?1 AND media_kind IN ('movie', 'tv-season'))"
          )
          .bind(user.user_id, now),
        database
          .prepare(
            "UPDATE media_metadata_jobs SET state = 'pending', available_at = ?2, lease_expires_at = NULL, last_error = NULL, updated_at = ?2 WHERE requested_user_id = ?1 AND state = 'failed' AND last_error = 'TMDB metadata is disabled'"
          )
          .bind(user.user_id, now),
      ])
    ).dataVersion
    await notifySafely(environment, user.user_id, dataVersion)
  }
}

const markExpiredMetadataGroupsPending = async (
  environment: Env,
  database: D1Database,
  now: number
): Promise<void> => {
  const users = await database
    .prepare(
      `SELECT DISTINCT user_id
       FROM title_groups
       WHERE metadata_state = 'available'
         AND metadata_expires_at IS NOT NULL
         AND metadata_expires_at <= ?1
       LIMIT ?2`
    )
    .bind(now, TITLE_GROUP_RECONCILIATION_USER_BATCH_SIZE)
    .all<{ user_id: string }>()
  for (const user of users.results) {
    const dataVersion = (
      await executeOwnedWrite(database, user.user_id, [
        database
          .prepare(
            "UPDATE title_groups SET metadata_state = 'pending', updated_at = ?2 WHERE user_id = ?1 AND metadata_state = 'available' AND metadata_expires_at IS NOT NULL AND metadata_expires_at <= ?2"
          )
          .bind(user.user_id, now),
        database
          .prepare(
            "UPDATE title_entries SET metadata_state = 'pending', updated_at = ?2 WHERE user_id = ?1 AND metadata_state = 'available' AND title_group_id IN (SELECT id FROM title_groups WHERE user_id = ?1 AND metadata_expires_at IS NOT NULL AND metadata_expires_at <= ?2)"
          )
          .bind(user.user_id, now),
      ])
    ).dataVersion
    await notifySafely(environment, user.user_id, dataVersion)
  }
}

const enqueuePendingGroups = async (
  database: D1Database,
  now: number
): Promise<number> => {
  const pending = await database
    .prepare(
      "SELECT id, user_id, media_kind, display_title, year, season_number, metadata_state FROM title_groups WHERE metadata_state = 'pending' AND media_kind IN ('movie', 'tv-season') ORDER BY last_added_at DESC LIMIT ?1"
    )
    .bind(MEDIA_METADATA_BATCH_SIZE)
    .all<PendingTitleGroupRow>()
  let enqueuedJobs = 0
  for (const group of pending.results) {
    const mediaKind = group.media_kind === "movie" ? "movie" : "tv"
    const result = await enqueueMediaMetadataJob(database, {
      jobKey: createMediaMetadataJobKey({
        provider: "tmdb",
        mediaKind,
        title: group.display_title,
        year: group.year ?? undefined,
        seasonNumber: group.season_number ?? undefined,
      }),
      requestedUserId: group.user_id,
      titleGroupId: group.id,
      provider: "tmdb",
      mediaKind,
      title: group.display_title,
      year: group.year ?? undefined,
      seasonNumber: group.season_number ?? undefined,
      now,
    })
    if (result.inserted || result.requeued) {
      enqueuedJobs += 1
    }
  }
  return enqueuedJobs
}

const removeObsoleteMetadataJobs = async (
  database: D1Database
): Promise<void> => {
  await database
    .prepare("DELETE FROM media_metadata_jobs WHERE job_key NOT LIKE ?1")
    .bind(`${MEDIA_METADATA_JOB_KEY_PREFIX}%`)
    .run()
}

const enqueueMissingEpisodeJobs = async (
  database: D1Database,
  now: number
): Promise<number> => {
  const episodes = await database
    .prepare(
      `SELECT g.id AS title_group_id, g.user_id, g.display_title, g.year, g.season_number, e.episode_start
       FROM title_groups g
       JOIN title_entries e ON e.title_group_id = g.id
       WHERE g.media_kind = 'tv-season'
         AND g.provider = 'tmdb'
         AND g.metadata_state = 'available'
         AND e.kind = 'episode'
         AND e.episode_start IS NOT NULL
         AND e.still_path IS NULL
       ORDER BY g.last_added_at DESC, e.episode_start ASC
       LIMIT ?1`
    )
    .bind(TITLE_GROUP_RECONCILIATION_USER_BATCH_SIZE)
    .all<{
      title_group_id: string
      user_id: string
      display_title: string
      year: number | null
      season_number: number | null
      episode_start: number
    }>()
  let enqueuedJobs = 0
  for (const episode of episodes.results) {
    if (enqueuedJobs >= MEDIA_METADATA_BATCH_SIZE) {
      break
    }
    const jobKey = createMediaMetadataJobKey({
      provider: "tmdb",
      mediaKind: "episode",
      title: episode.display_title,
      year: episode.year ?? undefined,
      seasonNumber: episode.season_number ?? undefined,
      episodeNumber: episode.episode_start,
    })
    const existingJob = await database
      .prepare("SELECT 1 FROM media_metadata_jobs WHERE job_key = ?1")
      .bind(jobKey)
      .first()
    if (existingJob) {
      continue
    }
    const result = await enqueueMediaMetadataJob(database, {
      jobKey,
      requestedUserId: episode.user_id,
      titleGroupId: episode.title_group_id,
      provider: "tmdb",
      mediaKind: "episode",
      title: episode.display_title,
      year: episode.year ?? undefined,
      seasonNumber: episode.season_number ?? undefined,
      episodeNumber: episode.episode_start,
      now,
    })
    if (result.inserted) {
      enqueuedJobs += 1
    }
  }
  return enqueuedJobs
}

const markFailedMetadataGroup = async (
  environment: Env,
  database: D1Database,
  job: MediaMetadataJob,
  now: number
): Promise<void> => {
  if (!job.titleGroupId || !job.requestedUserId) {
    return
  }
  const jobRow = await database
    .prepare(
      "SELECT state, last_error FROM media_metadata_jobs WHERE id = ?1 AND state = 'failed'"
    )
    .bind(job.id)
    .first<{ state: string; last_error: string | null }>()
  if (!jobRow || jobRow.last_error === "TMDB metadata is disabled") {
    return
  }
  const groups = await getTargetGroups(database, job)
  const groupsByUser = new Map<string, readonly MetadataTargetGroupRow[]>()
  for (const group of groups) {
    groupsByUser.set(group.user_id, [
      ...(groupsByUser.get(group.user_id) ?? []),
      group,
    ])
  }
  for (const [userId, userGroups] of groupsByUser) {
    const statements = userGroups.flatMap((group) => [
      database
        .prepare(
          "UPDATE title_groups SET metadata_state = 'failed', updated_at = ?3 WHERE id = ?1 AND user_id = ?2 AND metadata_state = 'pending'"
        )
        .bind(group.id, userId, now),
      database
        .prepare(
          "UPDATE title_entries SET metadata_state = 'failed', updated_at = ?2 WHERE title_group_id = ?1 AND user_id = ?3 AND metadata_state = 'pending'"
        )
        .bind(group.id, now, userId),
    ])
    const dataVersion = (await executeOwnedWrite(database, userId, statements))
      .dataVersion
    await notifySafely(environment, userId, dataVersion)
  }
}

export const processMediaMetadataMaintenance = async (
  environment: Env,
  database: D1Database,
  now = Date.now()
): Promise<MediaMetadataMaintenanceResult> => {
  const reconciledUsers = await reconcileMissingTitleGroups(database, now)
  await Promise.all(
    reconciledUsers.map((user) =>
      notifySafely(environment, user.userId, user.dataVersion)
    )
  )
  const token = getProviderToken(environment)
  if (!token) {
    await markProviderUnavailable(environment, database, now)
    return { disabled: true, enqueuedJobs: 0, processedJobs: 0 }
  }
  await reenableProviderGroups(environment, database, now)
  await markExpiredMetadataGroupsPending(environment, database, now)
  await removeObsoleteMetadataJobs(database)
  const enqueuedJobs =
    (await enqueuePendingGroups(database, now)) +
    (await enqueueMissingEpisodeJobs(database, now))
  const adapter = createTmdbAdapter({
    fetch: globalThis.fetch.bind(globalThis),
    token,
    now: () => now,
  })
  let processedJobs = 0
  for (let index = 0; index < MEDIA_METADATA_BATCH_SIZE; index += 1) {
    const claim = await claimNextMediaMetadataJob(database, now)
    if (!claim) {
      break
    }
    await processJob(
      environment,
      database,
      adapter,
      claim,
      claim.leaseExpiresAt,
      now
    )
    await markFailedMetadataGroup(environment, database, claim, now)
    processedJobs += 1
  }
  return { disabled: false, enqueuedJobs, processedJobs }
}

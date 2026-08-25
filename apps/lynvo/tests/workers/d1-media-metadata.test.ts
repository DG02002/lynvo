import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import {
  MEDIA_METADATA_ACCOUNT_JOB_LIMIT,
  MEDIA_METADATA_JOB_LEASE_MS,
} from "../../workers/constants"
import { insertGoogleUser } from "../../workers/d1/users"
import {
  claimNextMediaMetadataJob,
  createMediaMetadataJobKey,
  enqueueMediaMetadataJob,
  getMetadataRetryDelayMs,
  readMediaMetadataCache,
  reserveMediaMetadataRequest,
  settleMediaMetadataJob,
  writeMediaMetadataCache,
} from "../../workers/media-metadata/media-metadata-repository"
import type { TmdbMediaMetadata } from "../../workers/media-metadata/tmdb-adapter"

const NOW = 1_750_000_000_000

const createUser = async () =>
  insertGoogleUser(env.DB, {
    googleSubject: `subject-${crypto.randomUUID()}`,
    email: `metadata-${crypto.randomUUID()}@example.com`,
    now: NOW,
  })

const movieMetadata: TmdbMediaMetadata = {
  kind: "movie",
  providerId: 42,
  title: "Example Movie",
  year: 2026,
  posterPath: "/poster.jpg",
  attribution: "TMDB",
}

describe("media metadata repository", () => {
  it("serves fresh cache entries and marks expired entries stale", async () => {
    const cacheKey = `movie:${crypto.randomUUID()}`
    await writeMediaMetadataCache(env.DB, {
      cacheKey,
      provider: "tmdb",
      mediaKind: "movie",
      providerId: "42",
      payload: movieMetadata,
      attribution: "TMDB",
      now: NOW,
    })

    const fresh = await readMediaMetadataCache(env.DB, cacheKey, NOW + 1)
    const stale = await readMediaMetadataCache(
      env.DB,
      cacheKey,
      NOW + 180 * 24 * 60 * 60 * 1_000 + 1
    )

    expect(fresh?.isFresh).toBe(true)
    expect(fresh?.record.payload.title).toBe("Example Movie")
    expect(stale?.isFresh).toBe(false)
  })

  it("deduplicates jobs and recovers an expired lease", async () => {
    const user = await createUser()
    const jobKey = createMediaMetadataJobKey({
      provider: "tmdb",
      mediaKind: "movie",
      title: "Example Movie",
      year: 2026,
    })
    const input = {
      jobKey,
      requestedUserId: user.id,
      provider: "tmdb" as const,
      mediaKind: "movie" as const,
      title: "Example Movie",
      year: 2026,
      now: NOW,
    }

    expect((await enqueueMediaMetadataJob(env.DB, input)).inserted).toBe(true)
    expect((await enqueueMediaMetadataJob(env.DB, input)).inserted).toBe(false)

    const firstClaim = await claimNextMediaMetadataJob(env.DB, NOW)
    expect(firstClaim?.attemptCount).toBe(1)
    expect(
      await claimNextMediaMetadataJob(
        env.DB,
        NOW + MEDIA_METADATA_JOB_LEASE_MS - 1
      )
    ).toBeUndefined()

    const recoveredClaim = await claimNextMediaMetadataJob(
      env.DB,
      NOW + MEDIA_METADATA_JOB_LEASE_MS
    )
    expect(recoveredClaim?.id).toBe(firstClaim?.id)
    expect(recoveredClaim?.attemptCount).toBe(2)
  })

  it("requeues completed work for refresh and caps active account jobs", async () => {
    const user = await createUser()
    const input = {
      jobKey: `refresh:${crypto.randomUUID()}`,
      requestedUserId: user.id,
      provider: "tmdb" as const,
      mediaKind: "movie" as const,
      title: "Refresh movie",
      now: NOW,
    }
    await enqueueMediaMetadataJob(env.DB, input)
    const firstClaim = await claimNextMediaMetadataJob(env.DB, NOW)
    await settleMediaMetadataJob(env.DB, {
      id: firstClaim?.id ?? "",
      leaseExpiresAt: firstClaim?.leaseExpiresAt ?? 0,
      outcome: "succeeded",
      now: NOW + 1,
    })

    const refresh = await enqueueMediaMetadataJob(env.DB, {
      ...input,
      now: NOW + 2,
    })
    const refreshClaim = await claimNextMediaMetadataJob(env.DB, NOW + 2)
    await settleMediaMetadataJob(env.DB, {
      id: refreshClaim?.id ?? "",
      leaseExpiresAt: refreshClaim?.leaseExpiresAt ?? 0,
      outcome: "succeeded",
      now: NOW + 3,
    })

    const cappedUser = await createUser()
    for (let index = 0; index < MEDIA_METADATA_ACCOUNT_JOB_LIMIT; index += 1) {
      await enqueueMediaMetadataJob(env.DB, {
        jobKey: `cap:${crypto.randomUUID()}`,
        requestedUserId: cappedUser.id,
        provider: "tmdb",
        mediaKind: "movie",
        title: `Capped movie ${index}`,
        now: NOW,
      })
    }
    const blocked = await enqueueMediaMetadataJob(env.DB, {
      jobKey: `cap:${crypto.randomUUID()}`,
      requestedUserId: cappedUser.id,
      provider: "tmdb",
      mediaKind: "movie",
      title: "Blocked movie",
      now: NOW,
    })
    await env.DB.prepare(
      "DELETE FROM media_metadata_jobs WHERE requested_user_id = ?1"
    )
      .bind(cappedUser.id)
      .run()

    expect(refresh).toEqual({ inserted: false, requeued: true })
    expect(refreshClaim?.attemptCount).toBe(1)
    expect(blocked.inserted).toBe(false)
    expect(blocked.requeued).toBe(false)
  })

  it("uses provider retry times and stops on permanent failure", async () => {
    const user = await createUser()
    const jobKey = `retry:${crypto.randomUUID()}`
    await enqueueMediaMetadataJob(env.DB, {
      jobKey,
      requestedUserId: user.id,
      provider: "tmdb",
      mediaKind: "movie",
      title: "Retry movie",
      now: NOW,
    })
    const claim = await claimNextMediaMetadataJob(env.DB, NOW)
    expect(claim).toBeDefined()
    const rateLimited = await settleMediaMetadataJob(env.DB, {
      id: claim?.id ?? "",
      leaseExpiresAt: claim?.leaseExpiresAt ?? 0,
      outcome: "rate-limited",
      retryAt: NOW + 12_000,
      error: "Slow down",
      now: NOW + 1,
    })
    expect(rateLimited).toBe(true)
    const retryClaim = await claimNextMediaMetadataJob(env.DB, NOW + 12_000)
    expect(retryClaim?.attemptCount).toBe(2)
    const permanentlyFailed = await settleMediaMetadataJob(env.DB, {
      id: retryClaim?.id ?? "",
      leaseExpiresAt: retryClaim?.leaseExpiresAt ?? 0,
      outcome: "permanent",
      error: "Not found",
      now: NOW + 13_000,
    })
    expect(permanentlyFailed).toBe(true)

    const finalRow = await env.DB.prepare(
      "SELECT state, last_error FROM media_metadata_jobs WHERE id = ?1"
    )
      .bind(retryClaim?.id ?? "")
      .first<{ state: string; last_error: string }>()
    expect(finalRow).toEqual({ state: "failed", last_error: "Not found" })
    expect(getMetadataRetryDelayMs(1, () => 0)).toBeGreaterThan(0)
  })

  it("enforces the per-account daily request cap", async () => {
    const user = await createUser()
    const requestRows = Array.from({ length: 100 }, (_, index) =>
      env.DB.prepare(
        "INSERT INTO media_metadata_request_log (id, user_id, created_at) VALUES (?1, ?2, ?3)"
      ).bind(`request:${crypto.randomUUID()}:${index}`, user.id, NOW)
    )
    await env.DB.batch(requestRows)

    expect(await reserveMediaMetadataRequest(env.DB, user.id, NOW + 1)).toBe(
      false
    )
  })
})

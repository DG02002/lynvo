import { env } from "cloudflare:workers"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DAY_MS } from "../../workers/constants"
import { createOrUpdateSavedLink } from "../../workers/d1/links"
import { getDataVersion } from "../../workers/d1/data-version"
import { listTitleGroups } from "../../workers/d1/title-groups"
import { insertGoogleUser } from "../../workers/d1/users"
import { processMediaMetadataMaintenance } from "../../workers/media-metadata/media-metadata-coordinator"
import {
  claimNextMediaMetadataJob,
  createMediaMetadataJobKey,
  enqueueMediaMetadataJob,
  settleMediaMetadataJob,
} from "../../workers/media-metadata/media-metadata-repository"

const NOW = 1_750_000_000_000
const createdUserIds: string[] = []

const createUser = async () => {
  const user = await insertGoogleUser(env.DB, {
    googleSubject: `subject-${crypto.randomUUID()}`,
    email: `metadata-coordinator-${crypto.randomUUID()}@example.com`,
    now: NOW,
  })
  createdUserIds.push(user.id)
  return user
}

afterEach(async () => {
  for (const userId of createdUserIds) {
    await env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(userId).run()
  }
  createdUserIds.length = 0
})

const createMovieMetadata = (label: string) =>
  JSON.stringify({
    schemaVersion: 3,
    source: {},
    extraction: {
      extractedLinks: [
        {
          nodeKey: "movie-node",
          url: `https://media.example/${label}.mkv`,
          label,
          type: "file",
          mediaNodeKind: "playable",
        },
      ],
    },
    playback: { openedUrls: [], openedIds: [], resolvedMirrors: {} },
  })

describe("media metadata coordinator", () => {
  it("marks pending groups unavailable without a TMDB credential", async () => {
    const user = await createUser()
    await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: crypto.randomUUID(),
      url: "https://source.example/movie",
      meta: createMovieMetadata("Example Movie (2026) 1080p.mkv"),
      now: NOW,
    })
    const before = await getDataVersion(env.DB, user.id)

    const first = await processMediaMetadataMaintenance(env, env.DB, NOW + 1)
    const projection = await listTitleGroups(env.DB, user.id, NOW + 1)
    const afterFirst = await getDataVersion(env.DB, user.id)
    const second = await processMediaMetadataMaintenance(env, env.DB, NOW + 2)
    const afterSecond = await getDataVersion(env.DB, user.id)
    const jobCount = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM media_metadata_jobs WHERE requested_user_id = ?1"
    )
      .bind(user.id)
      .first<{ count: number }>()

    expect(first.disabled).toBe(true)
    expect(projection.dateGroups[0]?.groups[0]?.metadataState).toBe(
      "unavailable"
    )
    expect(afterFirst).toBe(before + 1)
    expect(second.disabled).toBe(true)
    expect(afterSecond).toBe(afterFirst)
    expect(jobCount?.count).toBe(1)
  })

  it("resolves movie metadata through the server-side queue", async () => {
    const user = await createUser()
    const secondUser = await createUser()
    await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: crypto.randomUUID(),
      url: "https://source.example/movie-with-metadata",
      meta: createMovieMetadata("Example Movie (2026) 1080p.mkv"),
      now: NOW,
    })
    await createOrUpdateSavedLink(env.DB, secondUser.id, {
      operationId: crypto.randomUUID(),
      url: "https://source.example/movie-with-metadata-copy",
      meta: createMovieMetadata("Example Movie (2026) 1080p.mkv"),
      now: NOW,
    })
    const environment = Object.create(env)
    environment.TMDB_API_READ_ACCESS_TOKEN = "test-token"
    const responses = [
      new Response(
        JSON.stringify({
          results: [
            {
              id: 7,
              title: "Example Movie Collection",
              release_date: "2026-01-01",
            },
            { id: 42, title: "Example Movie", release_date: "2026-01-01" },
          ],
        }),
        { status: 200 }
      ),
      new Response(
        JSON.stringify({
          id: 42,
          title: "Example Movie",
          release_date: "2026-01-01",
          poster_path: "/poster.jpg",
          overview: "A short description.",
        }),
        { status: 200 }
      ),
    ]
    let responseIndex = 0
    const fetch = vi.fn(function (this: typeof globalThis) {
      if (this !== globalThis) {
        throw new Error("fetch receiver was not globalThis")
      }
      const response = responses[responseIndex]
      responseIndex += 1
      return Promise.resolve(response)
    })
    vi.stubGlobal("fetch", fetch)

    try {
      const outcome = await processMediaMetadataMaintenance(
        environment,
        env.DB,
        NOW + 1
      )
      const projection = await listTitleGroups(env.DB, user.id, NOW + 1)
      const group = projection.dateGroups[0]?.groups[0]
      const secondProjection = await listTitleGroups(
        env.DB,
        secondUser.id,
        NOW + 1
      )
      const secondGroup = secondProjection.dateGroups[0]?.groups[0]

      expect(outcome).toMatchObject({
        disabled: false,
        enqueuedJobs: 0,
        processedJobs: 1,
      })
      expect(group?.metadataState).toBe("available")
      expect(group?.posterPath).toBe("/poster.jpg")
      expect(secondGroup?.metadataState).toBe("available")
      expect(secondGroup?.posterPath).toBe("/poster.jpg")
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(String(fetch.mock.calls[1]?.[0])).toContain("/movie/42")
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("does not treat a TV season year as the series first-air year", async () => {
    const user = await createUser()
    await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: crypto.randomUUID(),
      url: "https://source.example/sabrina-season-four",
      meta: JSON.stringify({
        schemaVersion: 3,
        source: {},
        extraction: {
          extractedLinks: [
            {
              nodeKey: "sabrina-season-four",
              url: "https://media.example/sabrina-s04e01.mkv",
              label:
                "Chilling Adventures of Sabrina 2020 S04E01 720p WEBRip.mkv",
              type: "file",
              mediaNodeKind: "playable",
            },
          ],
        },
        playback: { openedUrls: [], openedIds: [], resolvedMirrors: {} },
      }),
      now: NOW,
    })
    const environment = Object.create(env)
    environment.TMDB_API_READ_ACCESS_TOKEN = "test-token"
    const responses = [
      new Response(
        JSON.stringify({
          results: [
            {
              id: 79242,
              name: "Chilling Adventures of Sabrina",
              first_air_date: "2018-10-26",
            },
          ],
        }),
        { status: 200 }
      ),
      new Response(
        JSON.stringify({
          id: 79242,
          name: "Chilling Adventures of Sabrina",
          first_air_date: "2018-10-26",
          poster_path: "/sabrina.jpg",
        }),
        { status: 200 }
      ),
      new Response(
        JSON.stringify({
          id: 4,
          name: "Season 4",
          season_number: 4,
          poster_path: "/sabrina-season-four.jpg",
        }),
        { status: 200 }
      ),
      new Response(
        JSON.stringify({
          id: 1,
          name: "Chapter Twenty-Nine",
          season_number: 4,
          episode_number: 1,
          still_path: "/sabrina-episode-one.jpg",
        }),
        { status: 200 }
      ),
    ]
    let responseIndex = 0
    const fetch = vi.fn(() => {
      const response = responses[responseIndex]
      responseIndex += 1
      if (!response) {
        throw new Error("Missing metadata coordinator fixture response")
      }
      return Promise.resolve(response)
    })
    vi.stubGlobal("fetch", fetch)

    try {
      await processMediaMetadataMaintenance(environment, env.DB, NOW + 1)
      const projection = await listTitleGroups(env.DB, user.id, NOW + 1)
      const group = projection.dateGroups[0]?.groups[0]
      const episode = group?.entries[0]

      expect(group?.metadataState).toBe("available")
      expect(group?.posterPath).toBe("/sabrina-season-four.jpg")
      expect(episode?.stillPath).toBe("/sabrina-episode-one.jpg")
      expect(episode?.metadataTitle).toBe("Chapter Twenty-Nine")
      expect(fetch).toHaveBeenCalledTimes(4)
      expect(String(fetch.mock.calls[0]?.[0])).not.toContain(
        "first_air_date_year"
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("resets the attempt budget when a job is re-enqueued for a recreated title group", async () => {
    const user = await createUser()
    await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: crypto.randomUUID(),
      url: "https://source.example/requeued-movie",
      meta: createMovieMetadata("Requeued Movie (2026) 1080p.mkv"),
      now: NOW,
    })
    const group = await env.DB.prepare(
      "SELECT id FROM title_groups WHERE user_id = ?1 AND metadata_state = 'pending'"
    )
      .bind(user.id)
      .first<{ id: string }>()
    expect(group?.id).toBeDefined()
    const jobKey = createMediaMetadataJobKey({
      provider: "tmdb",
      mediaKind: "movie",
      title: "Requeued Movie",
      year: 2026,
    })
    const jobInput = {
      jobKey,
      requestedUserId: user.id,
      titleGroupId: group?.id,
      provider: "tmdb" as const,
      mediaKind: "movie" as const,
      title: "Requeued Movie",
      year: 2026,
    }

    await enqueueMediaMetadataJob(env.DB, { ...jobInput, now: NOW })
    await env.DB.prepare(
      "UPDATE media_metadata_jobs SET state = 'failed', attempt_count = 4, last_error = 'Title group no longer exists' WHERE job_key = ?1"
    )
      .bind(jobKey)
      .run()

    const requeued = await enqueueMediaMetadataJob(env.DB, {
      ...jobInput,
      now: NOW + 1000,
    })
    const row = await env.DB.prepare(
      "SELECT state, attempt_count, available_at, last_error FROM media_metadata_jobs WHERE job_key = ?1"
    )
      .bind(jobKey)
      .first<{
        state: string
        attempt_count: number
        available_at: number
        last_error: string | null
      }>()

    expect(requeued.requeued).toBe(true)
    expect(row?.state).toBe("pending")
    expect(row?.attempt_count).toBe(0)
    expect(row?.available_at).toBe(NOW + 1000)
    expect(row?.last_error).toBeNull()
  })

  it("keeps a re-enqueued job claimable after inherited failures", async () => {
    const user = await createUser()
    await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: crypto.randomUUID(),
      url: "https://source.example/claimable-movie",
      meta: createMovieMetadata("Claimable Movie (2026) 1080p.mkv"),
      now: NOW,
    })
    const group = await env.DB.prepare(
      "SELECT id FROM title_groups WHERE user_id = ?1 AND metadata_state = 'pending'"
    )
      .bind(user.id)
      .first<{ id: string }>()
    const jobKey = createMediaMetadataJobKey({
      provider: "tmdb",
      mediaKind: "movie",
      title: "Claimable Movie",
      year: 2026,
    })
    const jobInput = {
      jobKey,
      requestedUserId: user.id,
      titleGroupId: group?.id,
      provider: "tmdb" as const,
      mediaKind: "movie" as const,
      title: "Claimable Movie",
      year: 2026,
    }

    await enqueueMediaMetadataJob(env.DB, { ...jobInput, now: NOW })
    await env.DB.prepare(
      "UPDATE media_metadata_jobs SET state = 'failed', attempt_count = 4 WHERE job_key = ?1"
    )
      .bind(jobKey)
      .run()
    await enqueueMediaMetadataJob(env.DB, { ...jobInput, now: NOW + 500 })

    const claim = await claimNextMediaMetadataJob(env.DB, NOW + 501)
    expect(claim?.jobKey).toBe(jobKey)
    expect(claim?.attemptCount).toBe(1)
    const settled = await settleMediaMetadataJob(env.DB, {
      id: claim?.id ?? "",
      leaseExpiresAt: claim?.leaseExpiresAt ?? 0,
      outcome: "retryable",
      error: "temporary",
      now: NOW + 1002,
      random: () => 0,
    })
    expect(settled).toBe(true)
    const row = await env.DB.prepare(
      "SELECT state, attempt_count FROM media_metadata_jobs WHERE job_key = ?1"
    )
      .bind(jobKey)
      .first<{ state: string; attempt_count: number }>()
    expect(row?.state).toBe("pending")
    expect(row?.attempt_count).toBe(1)
  })

  it("does not apply the daily metadata request quota when usage limits are disabled", async () => {
    const user = await createUser()
    await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: crypto.randomUUID(),
      url: "https://source.example/quota-free-movie",
      meta: createMovieMetadata("Quota Free Movie (2026) 1080p.mkv"),
      now: NOW,
    })
    for (let requestIndex = 0; requestIndex < 100; requestIndex += 1) {
      await env.DB.prepare(
        "INSERT INTO media_metadata_request_log (id, user_id, created_at) VALUES (?1, ?2, ?3)"
      )
        .bind(crypto.randomUUID(), user.id, NOW)
        .run()
    }
    const environment = Object.create(env)
    environment.TMDB_API_READ_ACCESS_TOKEN = "test-token"
    environment.DISABLE_USAGE_LIMITS = "true"
    const responses = [
      new Response(
        JSON.stringify({
          results: [
            { id: 43, title: "Quota Free Movie", release_date: "2026-01-01" },
          ],
        }),
        { status: 200 }
      ),
      new Response(
        JSON.stringify({
          id: 43,
          title: "Quota Free Movie",
          release_date: "2026-01-01",
          poster_path: "/poster.jpg",
        }),
        { status: 200 }
      ),
    ]
    let responseIndex = 0
    const fetch = vi.fn(() => {
      const response = responses[responseIndex]
      responseIndex += 1
      return Promise.resolve(response)
    })
    vi.stubGlobal("fetch", fetch)

    try {
      await processMediaMetadataMaintenance(environment, env.DB, NOW + 1)
      const projection = await listTitleGroups(env.DB, user.id, NOW + 1)
      const group = projection.dateGroups[0]?.groups[0]

      expect(group?.metadataState).toBe("available")
      expect(group?.posterPath).toBe("/poster.jpg")
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("unparks quota-limited jobs when usage limits are disabled", async () => {
    const user = await createUser()
    await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: crypto.randomUUID(),
      url: "https://source.example/unparked-movie",
      meta: createMovieMetadata("Unparked Movie (2026) 1080p.mkv"),
      now: NOW,
    })
    const group = await env.DB.prepare(
      "SELECT id FROM title_groups WHERE user_id = ?1 AND metadata_state = 'pending'"
    )
      .bind(user.id)
      .first<{ id: string }>()
    const jobKey = createMediaMetadataJobKey({
      provider: "tmdb",
      mediaKind: "movie",
      title: "Unparked Movie",
      year: 2026,
    })
    await enqueueMediaMetadataJob(env.DB, {
      jobKey,
      requestedUserId: user.id,
      titleGroupId: group?.id,
      provider: "tmdb",
      mediaKind: "movie",
      title: "Unparked Movie",
      year: 2026,
      now: NOW,
    })
    await env.DB.prepare(
      "UPDATE media_metadata_jobs SET state = 'pending', attempt_count = 2, available_at = ?2, last_error = 'Metadata request limit reached' WHERE job_key = ?1"
    )
      .bind(jobKey, NOW + DAY_MS)
      .run()

    const environment = Object.create(env)
    environment.TMDB_API_READ_ACCESS_TOKEN = "test-token"
    environment.DISABLE_USAGE_LIMITS = "true"
    const responses = [
      new Response(
        JSON.stringify({
          results: [
            { id: 44, title: "Unparked Movie", release_date: "2026-01-01" },
          ],
        }),
        { status: 200 }
      ),
      new Response(
        JSON.stringify({
          id: 44,
          title: "Unparked Movie",
          release_date: "2026-01-01",
          poster_path: "/unparked.jpg",
        }),
        { status: 200 }
      ),
    ]
    let responseIndex = 0
    const fetch = vi.fn(() => {
      const response = responses[responseIndex]
      responseIndex += 1
      return Promise.resolve(response)
    })
    vi.stubGlobal("fetch", fetch)

    try {
      await processMediaMetadataMaintenance(environment, env.DB, NOW + 1)
      const projection = await listTitleGroups(env.DB, user.id, NOW + 1)
      const movieGroup = projection.dateGroups[0]?.groups[0]

      expect(movieGroup?.metadataState).toBe("available")
      expect(movieGroup?.posterPath).toBe("/unparked.jpg")
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

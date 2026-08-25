import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import { createOrUpdateSavedLink } from "../../workers/d1/links"
import {
  getTitleGroupById,
  listTitleGroups,
  reconcileMissingTitleGroups,
  reconcileTitleGroups,
} from "../../workers/d1/title-groups"
import { insertGoogleUser } from "../../workers/d1/users"
import type { LinkRow } from "../../workers/d1/rows"

const NOW = 1_750_000_000_000

const createUser = async () =>
  insertGoogleUser(env.DB, {
    googleSubject: `subject-${crypto.randomUUID()}`,
    email: `title-groups-${crypto.randomUUID()}@example.com`,
    now: NOW,
  })

const metadataJson = (label: string, target: string) =>
  JSON.stringify({
    schemaVersion: 3,
    source: {},
    extraction: {
      extractedLinks: [
        {
          nodeKey: `node:${label}`,
          url: target,
          label,
          type: "file",
          mediaNodeKind: "playable",
        },
      ],
    },
    playback: { openedUrls: [], resolvedMirrors: {} },
  })

const getRows = async (userId: string): Promise<LinkRow[]> => {
  const result = await env.DB.prepare(
    "SELECT * FROM links WHERE user_id = ?1 ORDER BY created_at ASC"
  )
    .bind(userId)
    .all<LinkRow>()
  return result.results
}

describe("d1 title groups", () => {
  it("rebuilds owned groups with stable opaque entity IDs", async () => {
    const user = await createUser()
    await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: crypto.randomUUID(),
      url: "https://source.example/episode-one",
      title: "Episode one",
      meta: metadataJson(
        "Example Show S01E01 1080p.mkv",
        "https://media.example/episode-one.mkv"
      ),
      now: NOW,
    })
    const firstVersion = await reconcileTitleGroups(
      env.DB,
      user.id,
      await getRows(user.id),
      NOW
    )
    const first = await listTitleGroups(env.DB, user.id, NOW)
    const firstGroup = first.dateGroups[0]?.groups[0]
    const firstEntry = firstGroup?.entries[0]
    const firstSource = firstEntry?.sources[0]

    expect(firstVersion).toBeGreaterThan(1)
    expect(firstGroup?.id).toBeDefined()
    expect(firstEntry?.id).toBeDefined()
    expect(firstSource?.id).toBeDefined()
    expect(firstGroup?.id).not.toContain("https://")
    expect(firstSource?.occurrenceKey).toContain(firstSource?.savedLinkId ?? "")
    const metadataJob = await env.DB.prepare(
      "SELECT title_group_id, state FROM media_metadata_jobs WHERE title_group_id = ?1"
    )
      .bind(firstGroup?.id)
      .first<{ title_group_id: string; state: string }>()
    expect(metadataJob).toEqual({
      title_group_id: firstGroup?.id,
      state: "pending",
    })

    const secondVersion = await reconcileTitleGroups(
      env.DB,
      user.id,
      await getRows(user.id),
      NOW + 1_000
    )
    const second = await listTitleGroups(env.DB, user.id, NOW + 1_000)
    const secondGroup = second.dateGroups[0]?.groups[0]
    const secondEntry = secondGroup?.entries[0]
    const secondSource = secondEntry?.sources[0]

    expect(secondVersion).toBe(firstVersion + 1)
    expect(secondGroup?.id).toBe(firstGroup?.id)
    expect(secondEntry?.id).toBe(firstEntry?.id)
    expect(secondSource?.id).toBe(firstSource?.id)
  })

  it("enforces ownership when reading a title group", async () => {
    const owner = await createUser()
    const stranger = await createUser()
    await createOrUpdateSavedLink(env.DB, owner.id, {
      operationId: crypto.randomUUID(),
      url: "https://source.example/movie",
      meta: metadataJson(
        "Example Movie (2026) 1080p.mkv",
        "https://media.example/movie.mkv"
      ),
      now: NOW,
    })
    await reconcileTitleGroups(env.DB, owner.id, await getRows(owner.id), NOW)
    const projection = await listTitleGroups(env.DB, owner.id, NOW)
    const groupId = projection.dateGroups[0]?.groups[0]?.id ?? ""

    expect(await getTitleGroupById(env.DB, owner.id, groupId)).not.toBeNull()
    expect(await getTitleGroupById(env.DB, stranger.id, groupId)).toBeNull()
  })

  it("backfills projection rows for existing saved links", async () => {
    const user = await createUser()
    await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: crypto.randomUUID(),
      url: "https://source.example/existing-movie",
      meta: metadataJson(
        "Existing Movie (2026) 1080p.mkv",
        "https://media.example/existing-movie.mkv"
      ),
      now: NOW,
    })
    await env.DB.prepare("DELETE FROM title_groups WHERE user_id = ?1")
      .bind(user.id)
      .run()

    const reconciled = await reconcileMissingTitleGroups(env.DB, NOW + 1)
    const projection = await listTitleGroups(env.DB, user.id, NOW + 1)

    expect(reconciled.map((entry) => entry.userId)).toContain(user.id)
    expect(projection.dateGroups[0]?.groups[0]?.id).toBeDefined()
  })

  it("keeps metadata job references while sources change", async () => {
    const user = await createUser()
    await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: crypto.randomUUID(),
      url: "https://source.example/episode-one",
      meta: metadataJson(
        "Reference Show S01E01.mkv",
        "https://media.example/reference-one.mkv"
      ),
      now: NOW,
    })
    const firstProjection = await listTitleGroups(env.DB, user.id, NOW)
    const groupId = firstProjection.dateGroups[0]?.groups[0]?.id ?? ""
    const jobId = crypto.randomUUID()
    await env.DB.prepare(
      `INSERT INTO media_metadata_jobs (id, job_key, requested_user_id, title_group_id, provider, media_kind, title, state, attempt_count, available_at, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 'tmdb', 'tv', 'Reference Show', 'pending', 0, ?5, ?5, ?5)`
    )
      .bind(jobId, `job:${jobId}`, user.id, groupId, NOW)
      .run()

    await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: crypto.randomUUID(),
      url: "https://source.example/episode-two",
      meta: metadataJson(
        "Reference Show S01E02.mkv",
        "https://media.example/reference-two.mkv"
      ),
      now: NOW + 1,
    })

    const job = await env.DB.prepare(
      "SELECT title_group_id FROM media_metadata_jobs WHERE id = ?1"
    )
      .bind(jobId)
      .first<{ title_group_id: string | null }>()
    const nextProjection = await listTitleGroups(env.DB, user.id, NOW + 1)
    expect(job?.title_group_id).toBe(groupId)
    expect(nextProjection.dateGroups[0]?.groups[0]?.entries).toHaveLength(2)
  })
})

import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import {
  applySavedLinkMetadataOperation,
  clearSavedLinks,
  cleanupSavedLinkCommandOperations,
  createOrUpdateSavedLink,
  deleteExpiredLinksForUser,
  deleteSavedLinkById,
  listSavedLinks,
  sweepExpiredLinks,
  updateSavedLinkMeta,
} from "../../workers/d1/links"
import {
  claimNextSavedLinkExtraction,
  enqueueSavedLinkExtraction,
  settleSavedLinkExtraction,
} from "../../workers/d1/link-extraction-queue"
import {
  EMPTY_LINK_METADATA_JSON,
  LINKS_MAX_COUNT,
} from "../../workers/constants"
import {
  insertGoogleUser,
  updateUserStorageRetentionDays,
} from "../../workers/d1/users"
import { getDataVersion } from "../../workers/d1/data-version"
import type { ExtractedLink } from "../../app/features/links/types"

const NOW = 1_750_000_000_000
const DAY_MS = 24 * 60 * 60 * 1000

const createUser = async () =>
  insertGoogleUser(env.DB, {
    googleSubject: `subject-${crypto.randomUUID()}`,
    email: "links-test@example.com",
    now: NOW,
  })

const playableLink: ExtractedLink = {
  nodeKey: "file:one",
  url: "https://media.example/one.mp4",
  label: "One",
  type: "file",
  mediaNodeKind: "playable",
}

const metadataJson = () =>
  JSON.stringify({
    schemaVersion: 3,
    source: {},
    extraction: { extractedLinks: [playableLink] },
    playback: { openedUrls: [], resolvedMirrors: {} },
  })

const emptyMetadataJson = () =>
  JSON.stringify({
    schemaVersion: 3,
    source: {},
    extraction: { extractedLinks: [] },
    playback: { openedUrls: [], resolvedMirrors: {} },
  })

describe("d1 links", () => {
  it("creates once when an operation is replayed after a lost response", async () => {
    const user = await createUser()
    const command = {
      operationId: "create:one",
      url: "https://example.com/one",
      title: "One",
      now: NOW,
    }
    const first = await createOrUpdateSavedLink(env.DB, user.id, command)
    const retry = await createOrUpdateSavedLink(env.DB, user.id, command)
    const snapshot = await listSavedLinks(env.DB, user.id, NOW)
    expect(retry.id).toBe(first.id)
    expect(retry.replayed).toBe(true)
    expect(first.replayed).toBe(false)
    expect(snapshot.results).toHaveLength(1)
  })

  it("updates the existing link for a repeated URL and keeps one row", async () => {
    const user = await createUser()
    await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: "upsert:first",
      url: "https://example.com/same",
      title: "First",
      now: NOW,
    })
    const second = await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: "upsert:second",
      url: "https://example.com/same",
      title: "Second",
      meta: emptyMetadataJson(),
      now: NOW + 1_000,
    })
    const snapshot = await listSavedLinks(env.DB, user.id, NOW)
    expect(snapshot.results).toHaveLength(1)
    expect(snapshot.results[0]?.title).toBe("Second")
    expect(snapshot.results[0]?.updatedAt).toBe(NOW + 1_000)
    expect(second.replayed).toBe(false)
  })

  it("bumps data_version on writes and echoes the current version on replay", async () => {
    const user = await createUser()
    const before = await getDataVersion(env.DB, user.id)
    const first = await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: "version:create",
      url: "https://example.com/version",
      now: NOW,
    })
    expect(first.dataVersion).toBe(before + 1)
    const replay = await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: "version:create",
      url: "https://example.com/version",
      now: NOW + 1_000,
    })
    expect(replay.dataVersion).toBe(before + 1)
    const updated = await updateSavedLinkMeta(env.DB, user.id, {
      operationId: "version:update",
      id: first.id ?? "",
      meta: metadataJson(),
      now: NOW + 2_000,
    })
    expect(updated.dataVersion).toBe(before + 2)
  })

  it("updates once when an updateMeta operation is replayed", async () => {
    const user = await createUser()
    const created = await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: "create:update-target",
      url: "https://example.com/update-target",
      now: NOW,
    })
    const command = {
      operationId: "update:one",
      id: created.id ?? "",
      meta: metadataJson(),
      now: NOW + 1_000,
    }
    const first = await updateSavedLinkMeta(env.DB, user.id, command)
    const retry = await updateSavedLinkMeta(env.DB, user.id, command)
    expect(retry.success).toBe(true)
    expect(retry.replayed).toBe(true)
    expect(first.replayed).toBe(false)
  })

  it("keeps extraction state on the Saved link while the queue settles", async () => {
    const user = await createUser()
    const queued = await enqueueSavedLinkExtraction(env.DB, user.id, {
      operationId: "extraction:queue",
      url: "https://source.example/Shows/",
      title: "Shows",
      now: NOW,
    })
    const queuedSnapshot = await listSavedLinks(env.DB, user.id, NOW)
    expect(queued.id).toBeDefined()
    expect(queuedSnapshot.results[0]?.extractionState).toBe("queued")

    const claim = await claimNextSavedLinkExtraction(env.DB, { now: NOW })
    expect(claim?.id).toBe(queued.id)
    const runningSnapshot = await listSavedLinks(env.DB, user.id, NOW)
    expect(runningSnapshot.results[0]?.extractionState).toBe("running")

    const settled = await settleSavedLinkExtraction(env.DB, user.id, {
      operationId: "extraction:settle",
      id: queued.id ?? "",
      leaseExpiresAt: claim?.leaseExpiresAt ?? 0,
      state: "complete",
      extractedLinks: [playableLink],
      now: NOW + 1_000,
    })
    const completeSnapshot = await listSavedLinks(env.DB, user.id, NOW + 1_000)
    expect(settled.success).toBe(true)
    expect(completeSnapshot.results[0]?.extractionState).toBe("complete")
    expect(completeSnapshot.results[0]?.title).toBe("Shows")
    expect(completeSnapshot.results[0]?.metaJson).toContain(playableLink.url)
  })

  it("keeps a failed extraction visible without scheduling a retry", async () => {
    const user = await createUser()
    const queued = await enqueueSavedLinkExtraction(env.DB, user.id, {
      operationId: "extraction:failed:queue",
      url: "https://source.example/failed",
      title: "Failed",
      now: NOW,
    })
    const claim = await claimNextSavedLinkExtraction(env.DB, { now: NOW })
    const settled = await settleSavedLinkExtraction(env.DB, user.id, {
      operationId: "extraction:failed:settle",
      id: queued.id ?? "",
      leaseExpiresAt: claim?.leaseExpiresAt ?? 0,
      state: "failed",
      error: "Unable to load links.",
      now: NOW + 1_000,
    })

    const failedSnapshot = await listSavedLinks(env.DB, user.id, NOW + 1_000)
    const retryClaim = await claimNextSavedLinkExtraction(env.DB, {
      now: NOW + 60_000,
    })
    expect(settled.success).toBe(true)
    expect(failedSnapshot.results[0]?.extractionState).toBe("failed")
    expect(failedSnapshot.results[0]?.extractionError).toBe(
      "Unable to load links."
    )
    expect(retryClaim).toBeUndefined()
  })

  it("ignores a late extraction result after a Saved link is deleted", async () => {
    const user = await createUser()
    const queued = await enqueueSavedLinkExtraction(env.DB, user.id, {
      operationId: "extraction:deleted:queue",
      url: "https://source.example/deleted",
      now: NOW,
    })
    const claim = await claimNextSavedLinkExtraction(env.DB, { now: NOW })
    await deleteSavedLinkById(env.DB, user.id, {
      id: queued.id ?? "",
      now: NOW + 1_000,
    })

    const settled = await settleSavedLinkExtraction(env.DB, user.id, {
      operationId: "extraction:deleted:settle",
      id: queued.id ?? "",
      leaseExpiresAt: claim?.leaseExpiresAt ?? 0,
      state: "complete",
      extractedLinks: [playableLink],
      now: NOW + 2_000,
    })
    expect(settled.success).toBe(false)
    expect(
      (await listSavedLinks(env.DB, user.id, NOW + 2_000)).results
    ).toHaveLength(0)
  })

  it("lists retained links newest first", async () => {
    const user = await createUser()
    for (const index of [1, 2, 3]) {
      await createOrUpdateSavedLink(env.DB, user.id, {
        operationId: `list:${index}`,
        url: `https://example.com/${index}`,
        now: NOW + index * 1_000,
      })
    }
    const snapshot = await listSavedLinks(env.DB, user.id, NOW + 4_000)
    expect(snapshot.results.map((link) => link.url)).toEqual([
      "https://example.com/3",
      "https://example.com/2",
      "https://example.com/1",
    ])
  })

  it("preserves opened state and mirrors in either commit order", async () => {
    const user = await createUser()
    const created = await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: "semantic:create",
      url: "https://source.example",
      meta: metadataJson(),
      now: NOW,
    })
    const linkId = created.id ?? ""
    await applySavedLinkMetadataOperation(env.DB, user.id, {
      operationId: "semantic:mirrors",
      id: linkId,
      operation: {
        kind: "cacheMirrors",
        lazyItemUrl: "https://lazy.example",
        mirrorsJson: JSON.stringify([playableLink]),
      },
      now: NOW + 1_000,
    })
    await applySavedLinkMetadataOperation(env.DB, user.id, {
      operationId: "semantic:opened",
      id: linkId,
      operation: { kind: "markOpened", linkUrl: playableLink.url ?? "" },
      now: NOW + 2_000,
    })
    const snapshot = await listSavedLinks(env.DB, user.id, NOW)
    const metadata = JSON.parse(snapshot.results[0]?.metaJson ?? "")
    expect(metadata.playback.openedUrls).toEqual([playableLink.url])
    expect(metadata.playback.resolvedMirrors["https://lazy.example"]).toEqual([
      playableLink,
    ])
  })

  it("does not resurrect a removed child and rejects stale replacement", async () => {
    const user = await createUser()
    const created = await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: "remove:create",
      url: "https://source.example",
      meta: metadataJson(),
      now: NOW,
    })
    const linkId = created.id ?? ""
    await applySavedLinkMetadataOperation(env.DB, user.id, {
      operationId: "remove:child",
      id: linkId,
      operation: {
        kind: "removeExtractedLink",
        linkKey: playableLink.nodeKey,
        linkUrl: playableLink.url ?? "",
      },
      now: NOW + 1_000,
    })
    await applySavedLinkMetadataOperation(env.DB, user.id, {
      operationId: "remove:opened",
      id: linkId,
      operation: { kind: "markOpened", linkUrl: playableLink.url ?? "" },
      now: NOW + 2_000,
    })
    await expect(
      applySavedLinkMetadataOperation(env.DB, user.id, {
        operationId: "replace:stale",
        id: linkId,
        operation: {
          kind: "replaceExtraction",
          expectedExtractionJson: JSON.stringify([playableLink]),
          extractedLinksJson: JSON.stringify([playableLink]),
        },
        now: NOW + 3_000,
      })
    ).rejects.toThrow("extraction changed")
    const snapshot = await listSavedLinks(env.DB, user.id, NOW)
    const metadata = JSON.parse(snapshot.results[0]?.metaJson ?? "")
    expect(metadata.extraction.extractedLinks).toEqual([])
  })

  it("clears cached mirrors when replacing source extraction", async () => {
    const user = await createUser()
    const created = await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: "refresh:create",
      url: "https://source.example",
      meta: metadataJson(),
      now: NOW,
    })
    const linkId = created.id ?? ""
    await applySavedLinkMetadataOperation(env.DB, user.id, {
      operationId: "refresh:mirrors",
      id: linkId,
      operation: {
        kind: "cacheMirrors",
        lazyItemUrl: "https://lazy.example",
        mirrorsJson: JSON.stringify([{ ...playableLink, size: "1 GB" }]),
      },
      now: NOW + 1_000,
    })
    await applySavedLinkMetadataOperation(env.DB, user.id, {
      operationId: "refresh:replace",
      id: linkId,
      operation: {
        kind: "replaceExtraction",
        expectedExtractionJson: JSON.stringify([playableLink]),
        extractedLinksJson: JSON.stringify([playableLink]),
      },
      now: NOW + 2_000,
    })
    const snapshot = await listSavedLinks(env.DB, user.id, NOW)
    const metadata = JSON.parse(snapshot.results[0]?.metaJson ?? "")
    expect(metadata.playback.resolvedMirrors).toEqual({})
  })

  it("refuses to delete another user's link", async () => {
    const owner = await createUser()
    const attacker = await createUser()
    const created = await createOrUpdateSavedLink(env.DB, owner.id, {
      operationId: "authz:create",
      url: "https://example.com/authz",
      now: NOW,
    })
    await expect(
      deleteSavedLinkById(env.DB, attacker.id, {
        id: created.id ?? "",
        now: NOW,
      })
    ).rejects.toThrow("Link not found or no longer available")
    const snapshot = await listSavedLinks(env.DB, owner.id, NOW)
    expect(snapshot.results).toHaveLength(1)
  })

  it("clears all links for a user", async () => {
    const user = await createUser()
    for (const index of [1, 2]) {
      await createOrUpdateSavedLink(env.DB, user.id, {
        operationId: `clear:${index}`,
        url: `https://example.com/clear-${index}`,
        now: NOW,
      })
    }
    const outcome = await clearSavedLinks(env.DB, user.id, { now: NOW })
    expect(outcome.deletedLinks).toBe(2)
    const snapshot = await listSavedLinks(env.DB, user.id, NOW)
    expect(snapshot.results).toHaveLength(0)
  })

  it("evicts the oldest link beyond the retention count", async () => {
    const user = await createUser()
    const seedStatements: D1PreparedStatement[] = []
    for (let index = 0; index < LINKS_MAX_COUNT; index += 1) {
      seedStatements.push(
        env.DB.prepare(
          "INSERT INTO links (id, user_id, url, title, meta_json, opened_at, created_at, updated_at, expires_at) VALUES (?1, ?2, ?3, NULL, ?4, NULL, ?5, ?5, ?6)"
        ).bind(
          `link-seed-${index}`,
          user.id,
          `https://example.com/lru-${index}`,
          EMPTY_LINK_METADATA_JSON,
          NOW + index * 1_000,
          NOW + index * 1_000 + 30 * DAY_MS
        )
      )
    }
    const batchChunkSize = 100
    for (
      let batchOffset = 0;
      batchOffset < seedStatements.length;
      batchOffset += batchChunkSize
    ) {
      await env.DB.batch(
        seedStatements.slice(batchOffset, batchOffset + batchChunkSize)
      )
    }
    await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: "lru:newest",
      url: "https://example.com/lru-newest",
      now: NOW + (LINKS_MAX_COUNT + 1) * 1_000,
    })
    const snapshot = await listSavedLinks(
      env.DB,
      user.id,
      NOW + (LINKS_MAX_COUNT + 2) * 1_000
    )
    expect(snapshot.results).toHaveLength(LINKS_MAX_COUNT)
    expect(snapshot.results[0]?.url).toBe("https://example.com/lru-newest")
    expect(
      snapshot.results.find((link) => link.url === "https://example.com/lru-0")
    ).toBeUndefined()
    expect(
      snapshot.results.find((link) => link.url === "https://example.com/lru-1")
    ).toBeDefined()
  })

  it("backfills expires_at on retention change and sweeps expired links", async () => {
    const user = await createUser()
    const created = await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: "retention:create",
      url: "https://example.com/retention",
      now: NOW,
    })
    const before = await env.DB.prepare(
      "SELECT expires_at FROM links WHERE id = ?1"
    )
      .bind(created.id ?? "")
      .first<{ expires_at: number }>()
    expect(before?.expires_at).toBe(NOW + 30 * DAY_MS)
    await updateUserStorageRetentionDays(env.DB, user.id, {
      days: 7,
      now: NOW,
    })
    const after = await env.DB.prepare(
      "SELECT expires_at FROM links WHERE id = ?1"
    )
      .bind(created.id ?? "")
      .first<{ expires_at: number }>()
    expect(after?.expires_at).toBe(NOW + 7 * DAY_MS)

    await expect(
      updateUserStorageRetentionDays(env.DB, user.id, {
        days: 10,
        now: NOW,
      })
    ).rejects.toThrow("Choose an available auto-delete period")

    const deletedForUser = await deleteExpiredLinksForUser(
      env.DB,
      user.id,
      7,
      NOW + 8 * DAY_MS
    )
    expect(deletedForUser).toBe(1)
    let snapshot = await listSavedLinks(env.DB, user.id, NOW)
    expect(snapshot.results).toHaveLength(0)

    const secondUser = await createUser()
    await createOrUpdateSavedLink(env.DB, secondUser.id, {
      operationId: "retention:sweep-target",
      url: "https://example.com/sweep",
      now: NOW,
    })
    const sweep = await sweepExpiredLinks(env.DB, NOW + 31 * DAY_MS)
    expect(sweep.deletedLinks).toBeGreaterThanOrEqual(1)
    snapshot = await listSavedLinks(env.DB, secondUser.id, NOW)
    expect(snapshot.results).toHaveLength(0)
    const ledger = await env.DB.prepare(
      "SELECT saved_link_count FROM storage_ledgers WHERE user_id = ?1"
    )
      .bind(secondUser.id)
      .first<{ saved_link_count: number }>()
    expect(ledger?.saved_link_count).toBe(0)
  })

  it("sweeps expired command operations by TTL", async () => {
    const user = await createUser()
    await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: "ttl:one",
      url: "https://example.com/ttl",
      now: NOW,
    })
    const deletedNone = await cleanupSavedLinkCommandOperations(
      env.DB,
      NOW + 1_000
    )
    expect(deletedNone.deleted).toBe(0)
    const deleted = await cleanupSavedLinkCommandOperations(
      env.DB,
      NOW + DAY_MS + 1_000
    )
    expect(deleted.deleted).toBeGreaterThanOrEqual(1)
    const remaining = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM link_command_operations WHERE user_id = ?1"
    )
      .bind(user.id)
      .first<{ count: number }>()
    expect(remaining?.count).toBe(0)
  })
})

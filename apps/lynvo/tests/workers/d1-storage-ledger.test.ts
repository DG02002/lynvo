import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import {
  assertStorageGrowth,
  calculateAppOwnedStorageUsage,
  getStorageLedger,
} from "../../workers/d1/storage-ledger"
import {
  createOrUpdateSavedLink,
  deleteExpiredLinksForUser,
  deleteSavedLinkById,
  updateSavedLinkMeta,
} from "../../workers/d1/links"
import { insertGoogleUser, updateUserStorageRetentionDays } from "../../workers/d1/users"
import {
  LinkTooLargeError,
  StorageLimitError,
} from "../../workers/d1/errors"
import { USER_STORAGE_LIMIT_BYTES } from "../../workers/constants"

const NOW = 1_750_000_000_000
const DAY_MS = 24 * 60 * 60 * 1000

const createUser = async () =>
  insertGoogleUser(env.DB, {
    googleSubject: `subject-${crypto.randomUUID()}`,
    email: "ledger-test@example.com",
    now: NOW,
  })

const emptyMetadataJson = (source: Record<string, unknown> = {}) =>
  JSON.stringify({
    schemaVersion: 3,
    source,
    extraction: { extractedLinks: [] },
    playback: { openedUrls: [], openedIds: [], resolvedMirrors: {} },
  })

const seedPluginInventory = async (
  userId: string,
  manifestSize: number,
  indexPrefix: string
) => {
  for (let serverIndex = 0; serverIndex < 4; serverIndex += 1) {
    await env.DB.prepare(
      `INSERT INTO user_plugin_servers (id, user_id, base_url, normalized_base_url, credential_status, manifest, enabled, priority, verification_status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 'pending', ?5, 1, ?6, 'verified', ?7, ?7)`
    )
      .bind(
        `${indexPrefix}-server-${serverIndex}`,
        userId,
        `https://${indexPrefix}-${serverIndex}.example`,
        `https://${indexPrefix}-${serverIndex}.example`,
        "x".repeat(manifestSize),
        serverIndex,
        NOW
      )
      .run()
  }
  await env.DB.prepare(
    `INSERT INTO user_plugin_domains (id, user_id, plugin_server_id, domain, plugin_id, credential_generation) VALUES (?1, ?2, ?3, ?4, ?5, 0)`
  )
    .bind(`${indexPrefix}-domain`, userId, `${indexPrefix}-server-0`, `${indexPrefix}.example`, "plugin-1")
    .run()
  await env.DB.prepare(
    `INSERT INTO user_plugin_credentials (id, user_id, plugin_domain_id, plugin_server_id, plugin_id, domain, ciphertext, nonce, algorithm, key_version, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'AES-256-GCM', 1, ?9, ?9)`
  )
    .bind(
      `${indexPrefix}-credential`,
      userId,
      `${indexPrefix}-domain`,
      `${indexPrefix}-server-0`,
      "plugin-1",
      `${indexPrefix}.example`,
      "ciphertext",
      "nonce",
      NOW
    )
    .run()
}

const expectLedgerMatchesInventory = async (userId: string) => {
  const ledger = await getStorageLedger(env.DB, userId)
  const inventory = await calculateAppOwnedStorageUsage(env.DB, userId)
  expect(ledger).toMatchObject(inventory)
  return { ledger, inventory }
}

describe("d1 storage ledger", () => {
  it("reconstructs a missing ledger from every enforced storage domain", async () => {
    const user = await createUser()
    await env.DB.prepare(
      `INSERT INTO links (id, user_id, url, meta_json, created_at, updated_at) VALUES ('existing-link', ?1, 'https://existing.example', ?2, ?3, ?3)`
    )
      .bind(user.id, emptyMetadataJson(), NOW)
      .run()
    await seedPluginInventory(user.id, 100, "recon")
    await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: "recon:create",
      url: "https://new.example",
      now: NOW,
    })
    const { ledger } = await expectLedgerMatchesInventory(user.id)
    expect(ledger?.pluginServerBytes).toBeGreaterThan(0)
    expect(ledger?.pluginDomainBytes).toBeGreaterThan(0)
    expect(ledger?.pluginCredentialBytes).toBeGreaterThan(0)
    expect(ledger?.savedLinkCount).toBe(2)
  })

  it("repairs an outdated ledger before applying a new delta", async () => {
    const user = await createUser()
    const created = await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: "repair:create",
      url: "https://version.example",
      now: NOW,
    })
    await env.DB.prepare(
      `UPDATE storage_ledgers SET schema_version = 0, link_bytes = 0, saved_link_count = 0 WHERE user_id = ?1`
    )
      .bind(user.id)
      .run()
    await updateSavedLinkMeta(env.DB, user.id, {
      operationId: "repair:update",
      id: created.id ?? "",
      meta: emptyMetadataJson(),
      now: NOW + 1_000,
    })
    const { ledger } = await expectLedgerMatchesInventory(user.id)
    expect(ledger?.schemaVersion).toBe(2)
  })

  it("tracks create, grow, shrink, and delete in the document transaction", async () => {
    const user = await createUser()
    const created = await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: "lifecycle:create",
      url: "https://ledger.example/item",
      title: "Initial",
      now: NOW,
    })
    const linkId = created.id ?? ""
    await updateSavedLinkMeta(env.DB, user.id, {
      operationId: "lifecycle:grow",
      id: linkId,
      meta: emptyMetadataJson({ description: "A larger metadata value" }),
      now: NOW + 1_000,
    })
    await updateSavedLinkMeta(env.DB, user.id, {
      operationId: "lifecycle:shrink",
      id: linkId,
      meta: emptyMetadataJson(),
      now: NOW + 2_000,
    })
    const beforeDelete = await expectLedgerMatchesInventory(user.id)
    expect(beforeDelete.ledger?.savedLinkCount).toBe(1)
    await deleteSavedLinkById(env.DB, user.id, {
      id: linkId,
      now: NOW + 3_000,
    })
    const afterDelete = await expectLedgerMatchesInventory(user.id)
    expect(afterDelete.ledger?.savedLinkCount).toBe(0)
  })

  it("rejects growth beyond the account storage quota", async () => {
    let rejection: (StorageLimitError | LinkTooLargeError)["rejection"] | null =
      null
    try {
      assertStorageGrowth(USER_STORAGE_LIMIT_BYTES + 1, 1)
    } catch (error) {
      if (
        error instanceof StorageLimitError ||
        error instanceof LinkTooLargeError
      ) {
        rejection = error.rejection
      }
    }
    expect(rejection).toMatchObject({
      kind: "storage-limit",
      limitBytes: USER_STORAGE_LIMIT_BYTES,
    })
    expect(() => assertStorageGrowth(1, 0)).not.toThrow()
  })

  it("rolls back the ledger when a link exceeds the per-link limit", async () => {
    const user = await createUser()
    await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: "toolarge:original",
      url: "https://ledger.example/original",
      now: NOW,
    })
    const before = await getStorageLedger(env.DB, user.id)

    let rejection: (StorageLimitError | LinkTooLargeError)["rejection"] | null =
      null
    try {
      await createOrUpdateSavedLink(env.DB, user.id, {
        operationId: "toolarge:rejected",
        url: "https://ledger.example/rejected",
        meta: emptyMetadataJson({ padding: "x".repeat(1024 * 1024) }),
        now: NOW + 1_000,
      })
    } catch (error) {
      if (
        error instanceof StorageLimitError ||
        error instanceof LinkTooLargeError
      ) {
        rejection = error.rejection
      }
    }
    expect(rejection).toMatchObject({ kind: "link-too-large", limitBytes: 262_144 })
    const after = await getStorageLedger(env.DB, user.id)
    expect(after).toEqual(before)
  })

  it("expires retained links without corrupting the ledger", async () => {
    const user = await createUser()
    await createOrUpdateSavedLink(env.DB, user.id, {
      operationId: "expiry:create",
      url: "https://expiry.example",
      now: NOW,
    })
    await updateUserStorageRetentionDays(env.DB, user.id, {
      days: 7,
      now: NOW,
    })
    await deleteExpiredLinksForUser(env.DB, user.id, 7, NOW + 8 * DAY_MS)
    await expectLedgerMatchesInventory(user.id)
    const ledger = await getStorageLedger(env.DB, user.id)
    expect(ledger?.savedLinkCount).toBe(0)
  })
})

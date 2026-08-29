import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import {
  drainAccountErasures,
  initiateAccountErasure,
  processAccountErasureStep,
} from "../../workers/d1/account-erasure"
import { createOrUpdateSavedLink } from "../../workers/d1/links"
import { createSession } from "../../workers/d1/sessions"
import { getUserById, insertGoogleUser } from "../../workers/d1/users"
import { reserveManagedExtraction } from "../../workers/d1/usage"

const NOW = 1_750_000_000_000

const seedErasableAccount = async () => {
  const user = await insertGoogleUser(env.DB, {
    googleSubject: `subject-${crypto.randomUUID()}`,
    email: "erasure-test@example.com",
    now: NOW,
  })
  const suffix = crypto.randomUUID().slice(0, 8)
  const session = await createSession(env.DB, { userId: user.id, now: NOW })
  await createOrUpdateSavedLink(env.DB, user.id, {
    operationId: `erasure:link:${suffix}`,
    url: "https://erasure.example",
    now: NOW,
  })
  await env.DB.prepare(
    `INSERT INTO user_plugin_servers (id, user_id, base_url, normalized_base_url, credential_status, manifest, enabled, priority, verification_status, created_at, updated_at)
     VALUES (?1, ?2, 'https://erasure.example', 'https://erasure.example', 'ready', '{}', 1, 0, 'verified', ?3, ?3)`
  )
    .bind(`erasure-server-${suffix}`, user.id, NOW)
    .run()
  await env.DB.prepare(
    `INSERT INTO user_plugin_domains (id, user_id, plugin_server_id, domain, plugin_id, credential_generation)
     VALUES (?1, ?2, ?3, 'erasure.example', 'plugin-1', 0)`
  )
    .bind(`erasure-domain-${suffix}`, user.id, `erasure-server-${suffix}`)
    .run()
  await env.DB.prepare(
    `INSERT INTO user_plugin_credentials (id, user_id, plugin_domain_id, plugin_server_id, plugin_id, domain, ciphertext, nonce, algorithm, key_version, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, 'plugin-1', 'erasure.example', 'ciphertext', 'nonce', 'AES-256-GCM', 1, ?5, ?5)`
  )
    .bind(
      `erasure-credential-${suffix}`,
      user.id,
      `erasure-domain-${suffix}`,
      `erasure-server-${suffix}`,
      NOW
    )
    .run()
  await env.DB.prepare(
    `INSERT INTO device_codes (code, poll_secret_digest, status, device_name, user_id, expires_at, created_at)
     VALUES (?1, 'digest', 'pending', 'Erasure TV', ?2, ?3, ?4)`
  )
    .bind(
      `ERASUR${
        suffix
          .replace(/[^A-Z]/gi, "")
          .toUpperCase()
          .slice(0, 6) || "ABCDEF"
      }`,
      user.id,
      NOW + 600_000,
      NOW
    )
    .run()
  await env.DB.prepare(
    `INSERT INTO remote_commands (id, user_id, target_session_id, target_receiver_id, command, payload, created_at, expires_at, status, available_at, notification_pending)
     VALUES (?1, ?2, ?3, 'receiver', 'play', '{}', ?4, ?5, 'queued', ?4, 1)`
  )
    .bind(`erasure-command-${suffix}`, user.id, session.id, NOW, NOW + 300_000)
    .run()
  await reserveManagedExtraction(env.DB, user.id, {
    operationId: `erasure:extraction:${suffix}`,
    pluginId: "direct-media",
    now: NOW,
  })
  return { user, session }
}

describe("d1 account erasure", () => {
  it("reports missing progress for unknown users", async () => {
    await expect(
      processAccountErasureStep(env.DB, "missing-user")
    ).resolves.toEqual({ kind: "missing" })
  })

  it("erases every owned row through the staged state machine", async () => {
    const { user } = await seedErasableAccount()

    expect(
      await initiateAccountErasure(env.DB, user.id, {
        trigger: "manual",
        now: NOW,
      })
    ).toBe(true)
    expect(
      await initiateAccountErasure(env.DB, user.id, {
        trigger: "manual",
        now: NOW,
      })
    ).toBe(false)

    const pendingAt = await env.DB.prepare(
      "SELECT erasure_pending_at FROM users WHERE id = ?1"
    )
      .bind(user.id)
      .first<{ erasure_pending_at: number }>()
    expect(pendingAt?.erasure_pending_at).toBe(NOW)

    let lastStage = ""
    for (let step = 0; step < 50; step += 1) {
      const outcome = await processAccountErasureStep(env.DB, user.id)
      if (outcome.kind === "done") {
        break
      }
      if (outcome.kind === "stage") {
        lastStage = outcome.stage
      }
    }
    expect(lastStage.length).toBeGreaterThan(0)

    for (const [table, column] of [
      ["links", "user_id"],
      ["link_command_operations", "user_id"],
      ["user_plugin_servers", "user_id"],
      ["user_plugin_domains", "user_id"],
      ["user_plugin_credentials", "user_id"],
      ["device_codes", "user_id"],
      ["remote_commands", "user_id"],
      ["managed_extraction_operations", "user_id"],
      ["storage_ledgers", "user_id"],
      ["sessions", "user_id"],
      ["account_erasures", "user_id"],
    ] as const) {
      const remaining = await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM ${table} WHERE ${column} = ?1`
      )
        .bind(user.id)
        .first<{ count: number }>()
      expect(remaining?.count).toBe(0)
    }
    const usageCounters = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM usage_counters WHERE owner_key = ?1"
    )
      .bind(`user:${user.id}`)
      .first<{ count: number }>()
    expect(usageCounters?.count).toBe(0)

    const userRow = await env.DB.prepare("SELECT id FROM users WHERE id = ?1")
      .bind(user.id)
      .first<{ id: string }>()
    expect(userRow).toBeNull()

    await drainAccountErasures(env.DB)
  })

  it("drains seeded erasures to completion", async () => {
    const { user } = await seedErasableAccount()
    await initiateAccountErasure(env.DB, user.id, {
      trigger: "inactive",
      now: NOW,
      cleanup: { processedUsers: 0, startedAt: NOW },
    })
    const outcome = await drainAccountErasures(env.DB)
    expect(outcome.processedUsers).toBeGreaterThanOrEqual(1)
    const userRow = await env.DB.prepare("SELECT id FROM users WHERE id = ?1")
      .bind(user.id)
      .first<{ id: string }>()
    expect(userRow).toBeNull()
  })

  it("drains only the requested account during manual erasure", async () => {
    const first = await seedErasableAccount()
    const second = await seedErasableAccount()
    await initiateAccountErasure(env.DB, first.user.id, {
      trigger: "manual",
      now: NOW,
    })
    await initiateAccountErasure(env.DB, second.user.id, {
      trigger: "inactive",
      now: NOW,
    })

    await drainAccountErasures(env.DB, first.user.id)

    expect(await getUserById(env.DB, first.user.id)).toBeNull()
    expect(await getUserById(env.DB, second.user.id)).not.toBeNull()
  })

  it("recovers an erasure whose persisted stage skipped owned data", async () => {
    const { user } = await seedErasableAccount()
    await initiateAccountErasure(env.DB, user.id, {
      trigger: "manual",
      now: NOW,
    })
    await env.DB.prepare(
      "UPDATE account_erasures SET stage = 'finalize' WHERE user_id = ?1"
    )
      .bind(user.id)
      .run()

    await drainAccountErasures(env.DB)

    const remainingUserData = await env.DB.batch([
      env.DB.prepare("SELECT id FROM users WHERE id = ?1").bind(user.id),
      env.DB.prepare(
        "SELECT rowid FROM usage_counters WHERE owner_key = ?1 LIMIT 1"
      ).bind(`user:${user.id}`),
      env.DB.prepare("SELECT id FROM links WHERE user_id = ?1 LIMIT 1").bind(
        user.id
      ),
    ])
    expect(remainingUserData.every(({ results }) => results.length === 0)).toBe(
      true
    )
  })
})

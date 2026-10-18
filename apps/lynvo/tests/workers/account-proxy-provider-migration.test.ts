import { applyD1Migrations } from "cloudflare:test"
import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

import { insertGoogleUser } from "../../workers/d1/users"

interface LegacyProxyRowInput {
  readonly id: string
  readonly userId: string
  readonly createdAt: number
  readonly updatedAt: number
}

const insertLegacyProxyRow = async (
  database: D1Database,
  row: LegacyProxyRowInput
) =>
  await database
    .prepare(
      `INSERT INTO user_plugin_servers (
        id, user_id, base_url, normalized_base_url, credential_status,
        manifest, enabled, priority, verification_status, created_at, updated_at,
        proxy_token_ciphertext, proxy_token_nonce, proxy_token_algorithm,
        proxy_token_version, proxy_balance_remaining, proxy_balance_limit,
        proxy_balance_checked_at
      ) VALUES (?1, ?2, ?3, ?3, 'ready', '{}', 1, 0, 'verified', ?4, ?5, ?6, ?7, 'AES-256-GCM', 1, 17, 23, 29)`
    )
    .bind(
      row.id,
      row.userId,
      `https://${row.id}.example.com`,
      row.createdAt,
      row.updatedAt,
      `ciphertext-${row.id}`,
      `nonce-${row.id}`
    )
    .run()

describe("account proxy provider migration", () => {
  it("moves each account's deterministic winning legacy credential", async () => {
    const environment = env
    const migrationIndex = environment.TEST_MIGRATIONS.findIndex((migration) =>
      migration.name.endsWith("0004_account_proxy_provider.sql")
    )
    if (migrationIndex < 1) {
      throw new Error("Account proxy provider migration was not found")
    }

    await applyD1Migrations(
      environment.MIGRATION_DB,
      environment.TEST_MIGRATIONS.slice(0, migrationIndex)
    )

    const users = await Promise.all(
      ["updated", "created", "id"].map((suffix) =>
        insertGoogleUser(environment.MIGRATION_DB, {
          googleSubject: `proxy-migration-${suffix}-${crypto.randomUUID()}`,
          email: `proxy-migration-${suffix}@example.com`,
          now: 1_750_000_000_000,
        })
      )
    )
    const [updatedUser, createdUser, idUser] = users
    if (!updatedUser || !createdUser || !idUser) {
      throw new Error("Failed to create migration test users")
    }

    await insertLegacyProxyRow(environment.MIGRATION_DB, {
      id: "updated-winner",
      userId: updatedUser.id,
      createdAt: 100,
      updatedAt: 5,
    })
    await insertLegacyProxyRow(environment.MIGRATION_DB, {
      id: "updated-loser",
      userId: updatedUser.id,
      createdAt: 1,
      updatedAt: 6,
    })
    await insertLegacyProxyRow(environment.MIGRATION_DB, {
      id: "created-winner",
      userId: createdUser.id,
      createdAt: 1,
      updatedAt: 5,
    })
    await insertLegacyProxyRow(environment.MIGRATION_DB, {
      id: "created-loser",
      userId: createdUser.id,
      createdAt: 2,
      updatedAt: 5,
    })
    await insertLegacyProxyRow(environment.MIGRATION_DB, {
      id: "a-id-winner",
      userId: idUser.id,
      createdAt: 1,
      updatedAt: 5,
    })
    await insertLegacyProxyRow(environment.MIGRATION_DB, {
      id: "z-id-loser",
      userId: idUser.id,
      createdAt: 1,
      updatedAt: 5,
    })

    const migration = environment.TEST_MIGRATIONS[migrationIndex]
    if (!migration) {
      throw new Error("Account proxy provider migration was not found")
    }
    await applyD1Migrations(environment.MIGRATION_DB, [migration])

    const { results } = await environment.MIGRATION_DB.prepare(
      `SELECT user_id, legacy_plugin_server_id, token_ciphertext, token_nonce,
              balance_remaining, balance_limit, balance_checked_at
       FROM user_proxy_providers`
    ).all<{
      user_id: string
      legacy_plugin_server_id: string
      token_ciphertext: string
      token_nonce: string
      balance_remaining: number
      balance_limit: number
      balance_checked_at: number
    }>()
    const rowsByUserId = new Map(results.map((row) => [row.user_id, row]))

    expect(rowsByUserId.get(updatedUser.id)).toMatchObject({
      legacy_plugin_server_id: "updated-winner",
      token_ciphertext: "ciphertext-updated-winner",
      token_nonce: "nonce-updated-winner",
      balance_remaining: 17,
      balance_limit: 23,
      balance_checked_at: 29,
    })
    expect(rowsByUserId.get(createdUser.id)).toMatchObject({
      legacy_plugin_server_id: "created-winner",
      token_ciphertext: "ciphertext-created-winner",
    })
    expect(rowsByUserId.get(idUser.id)).toMatchObject({
      legacy_plugin_server_id: "a-id-winner",
      token_ciphertext: "ciphertext-a-id-winner",
    })
  })
})

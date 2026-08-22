import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import {
  beginPluginServerRegistration,
  deletePluginServerById,
  finalizePluginServerCredential,
  listPluginServers,
  listReadyPluginServersForService,
  markPluginServerRegistrationFailed,
  recordPluginServerRefreshSuccess,
  recordPluginServerVerificationFailure,
  recordPluginServerVerificationSuccess,
  setPluginServerEnabled,
} from "../../workers/d1/plugin-servers"
import {
  beginPluginDomainCredentialChange,
  deletePluginDomainById,
  deletePluginDomainCredential,
  finalizePluginDomainCredentialChange,
  getPluginDomainByDomain,
  listPluginDomains,
  setPluginDomainCredential,
  upsertPluginDomain,
} from "../../workers/d1/plugin-domains"
import { insertGoogleUser } from "../../workers/d1/users"
import {
  calculateAppOwnedStorageUsage,
  getStorageLedger,
} from "../../workers/d1/storage-ledger"

const NOW = 1_750_000_000_000

const createUser = async () =>
  insertGoogleUser(env.DB, {
    googleSubject: `subject-${crypto.randomUUID()}`,
    email: "plugin-test@example.com",
    now: NOW,
  })

const credential = () => ({
  ciphertext: "ciphertext",
  nonce: "nonce",
  algorithm: "AES-256-GCM" as const,
  keyVersion: 1,
})

const finalizeInput = (
  registration: { id: string; generation: number; attemptId: string },
  manifest: string,
  now: number
) => ({
  id: registration.id,
  apiKeyCiphertext: credential().ciphertext,
  apiKeyNonce: credential().nonce,
  apiKeyAlgorithm: credential().algorithm,
  apiKeyVersion: credential().keyVersion,
  manifest,
  generation: registration.generation,
  attemptId: registration.attemptId,
  now,
})

const expectLedgerMatchesInventory = async (userId: string) => {
  const ledger = await getStorageLedger(env.DB, userId)
  const inventory = await calculateAppOwnedStorageUsage(env.DB, userId)
  expect(ledger).toMatchObject(inventory)
}

const registerReadyServer = async (
  userId: string,
  baseUrl: string,
  manifest = "{}"
) => {
  const registration = await beginPluginServerRegistration(env.DB, userId, {
    baseUrl,
    now: NOW,
  })
  await finalizePluginServerCredential(env.DB, userId, {
    id: registration.id,
    apiKeyCiphertext: credential().ciphertext,
    apiKeyNonce: credential().nonce,
    apiKeyAlgorithm: credential().algorithm,
    apiKeyVersion: credential().keyVersion,
    manifest,
    generation: registration.generation,
    attemptId: registration.attemptId,
    now: NOW + 1_000,
  })
  return registration
}

describe("d1 plugin registry", () => {
  it("registers, supersedes, finalizes, and lists a plugin server", async () => {
    const user = await createUser()
    const first = await beginPluginServerRegistration(env.DB, user.id, {
      baseUrl: "https://plugins.example/base/",
      now: NOW,
    })
    expect(first.resumed).toBe(false)
    expect(first.generation).toBe(1)
    expect(first.attemptId).toBeTruthy()

    const resumed = await beginPluginServerRegistration(env.DB, user.id, {
      baseUrl: "https://plugins.example/base",
      now: NOW + 1_000,
    })
    expect(resumed.resumed).toBe(true)
    expect(resumed.id).toBe(first.id)
    expect(resumed.generation).toBe(2)

    await expect(
      finalizePluginServerCredential(
        env.DB,
        user.id,
        finalizeInput(first, "{}", NOW + 2_000)
      )
    ).rejects.toThrow("superseded")

    const finalized = await finalizePluginServerCredential(
      env.DB,
      user.id,
      finalizeInput(resumed, '{"name":"Test"}', NOW + 2_000)
    )
    expect(finalized.success).toBe(true)

    const replayedFinalize = await finalizePluginServerCredential(
      env.DB,
      user.id,
      finalizeInput(resumed, '{"name":"Test"}', NOW + 3_000)
    )
    expect(replayedFinalize.success).toBe(true)

    await expect(
      beginPluginServerRegistration(env.DB, user.id, {
        baseUrl: "https://plugins.example/base",
        now: NOW + 4_000,
      })
    ).rejects.toThrow("already registered")

    const listed = await listPluginServers(env.DB, user.id)
    expect(listed).toHaveLength(1)
    expect(listed[0]?.baseUrl).toBe("https://plugins.example/base")
    expect(listed[0]?.manifest).toBe('{"name":"Test"}')
    expect(listed[0]).not.toHaveProperty("apiKeyCiphertext")
    const forService = await listReadyPluginServersForService(env.DB, user.id)
    expect(forService[0]?.apiKeyCiphertext).toBe("ciphertext")
    expect(forService[0]?.apiKeyAlgorithm).toBe("AES-256-GCM")
  })

  it("enforces the saved plugin server limit", async () => {
    const user = await createUser()
    for (let index = 0; index < 5; index += 1) {
      await beginPluginServerRegistration(env.DB, user.id, {
        baseUrl: `https://server-${index}.example`,
        now: NOW,
      })
    }
    await expect(
      beginPluginServerRegistration(env.DB, user.id, {
        baseUrl: "https://server-5.example",
        now: NOW + 1_000,
      })
    ).rejects.toThrow("saved plugin server limit")
  })

  it("marks failed registrations and rejects stale attempts", async () => {
    const user = await createUser()
    const registration = await beginPluginServerRegistration(env.DB, user.id, {
      baseUrl: "https://failing.example",
      now: NOW,
    })
    await expect(
      markPluginServerRegistrationFailed(env.DB, user.id, {
        id: registration.id,
        reason: "unreachable",
        generation: registration.generation + 1,
        attemptId: registration.attemptId,
        now: NOW + 1_000,
      })
    ).rejects.toThrow("superseded")
    const marked = await markPluginServerRegistrationFailed(env.DB, user.id, {
      id: registration.id,
      reason: "unreachable",
      generation: registration.generation,
      attemptId: registration.attemptId,
      now: NOW + 1_000,
    })
    expect(marked.success).toBe(true)
    const row = await env.DB.prepare(
      "SELECT credential_status, failure_reason FROM user_plugin_servers WHERE id = ?1"
    )
      .bind(registration.id)
      .first<{ credential_status: string; failure_reason: string }>()
    expect(row?.credential_status).toBe("failed")
    expect(row?.failure_reason).toBe("unreachable")
  })

  it("refuses another user's plugin server operations", async () => {
    const owner = await createUser()
    const attacker = await createUser()
    const registration = await registerReadyServer(
      owner.id,
      "https://owned.example"
    )
    await expect(
      setPluginServerEnabled(env.DB, attacker.id, {
        id: registration.id,
        enabled: false,
        now: NOW,
      })
    ).rejects.toThrow("Plugin server not found or no longer available")
    await expect(
      deletePluginServerById(env.DB, attacker.id, {
        id: registration.id,
        now: NOW,
      })
    ).rejects.toThrow("Plugin server not found or no longer available")
  })

  it("tracks verification state and manifest refreshes", async () => {
    const user = await createUser()
    const registration = await registerReadyServer(user.id, "https://health.example")
    await recordPluginServerVerificationFailure(env.DB, user.id, {
      id: registration.id,
      now: NOW + 1_000,
    })
    let row = await env.DB.prepare(
      "SELECT verification_status FROM user_plugin_servers WHERE id = ?1"
    )
      .bind(registration.id)
      .first<{ verification_status: string }>()
    expect(row?.verification_status).toBe("down")
    await recordPluginServerVerificationSuccess(env.DB, user.id, {
      id: registration.id,
      now: NOW + 2_000,
    })
    await recordPluginServerRefreshSuccess(env.DB, user.id, {
      id: registration.id,
      manifest: '{"name":"Refreshed"}',
      now: NOW + 3_000,
    })
    row = await env.DB.prepare(
      "SELECT verification_status, last_verified_at, last_manifest_refresh_at, manifest FROM user_plugin_servers WHERE id = ?1"
    )
      .bind(registration.id)
      .first<{
        verification_status: string
        last_verified_at: number
        last_manifest_refresh_at: number
        manifest: string
      }>()
    expect(row?.verification_status).toBe("verified")
    expect(row?.last_verified_at).toBe(NOW + 3_000)
    expect(row?.last_manifest_refresh_at).toBe(NOW + 3_000)
    expect(row?.manifest).toBe('{"name":"Refreshed"}')
  })

  it("toggles enabled and deletes servers with dependent domains", async () => {
    const user = await createUser()
    const registration = await registerReadyServer(
      user.id,
      "https://cascade.example"
    )
    await upsertPluginDomain(env.DB, user.id, {
      domain: "cascade.example",
      pluginServerId: registration.id,
      pluginId: "plugin-1",
      credential: credential(),
      now: NOW + 1_000,
    })
    await setPluginServerEnabled(env.DB, user.id, {
      id: registration.id,
      enabled: false,
      now: NOW + 2_000,
    })
    const enabledRow = await env.DB.prepare(
      "SELECT enabled FROM user_plugin_servers WHERE id = ?1"
    )
      .bind(registration.id)
      .first<{ enabled: number }>()
    expect(enabledRow?.enabled).toBe(0)

    await deletePluginServerById(env.DB, user.id, {
      id: registration.id,
      now: NOW + 3_000,
    })
    const serverRows = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM user_plugin_servers WHERE user_id = ?1"
    )
      .bind(user.id)
      .first<{ count: number }>()
    const domainRows = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM user_plugin_domains WHERE user_id = ?1"
    )
      .bind(user.id)
      .first<{ count: number }>()
    const credentialRows = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM user_plugin_credentials WHERE user_id = ?1"
    )
      .bind(user.id)
      .first<{ count: number }>()
    expect(serverRows?.count).toBe(0)
    expect(domainRows?.count).toBe(0)
    expect(credentialRows?.count).toBe(0)
    await expectLedgerMatchesInventory(user.id)
  })

  it("upserts domains, reassigns plugins, and manages credentials", async () => {
    const user = await createUser()
    const created = await upsertPluginDomain(env.DB, user.id, {
      domain: "Domain.Example",
      pluginServerId: "server-1",
      pluginId: "plugin-1",
      credential: credential(),
      now: NOW,
    })
    expect(created.id).toBeTruthy()

    const lookup = await getPluginDomainByDomain(env.DB, user.id, {
      domain: "domain.example",
      pluginServerId: "server-1",
    })
    expect(lookup?.id).toBe(created.id)
    expect(lookup?.pluginId).toBe("plugin-1")

    let listing = await listPluginDomains(env.DB, user.id)
    expect(listing[0]?.hasCredential).toBe(true)

    await setPluginDomainCredential(env.DB, user.id, {
      domainId: created.id,
      credential: { ...credential(), ciphertext: "larger-ciphertext-value" },
      now: NOW + 1_000,
    })

    const change = await beginPluginDomainCredentialChange(env.DB, user.id, {
      domainId: created.id,
      now: NOW + 2_000,
    })
    expect(change.generation).toBe(2)
    await finalizePluginDomainCredentialChange(env.DB, user.id, {
      domainId: created.id,
      generation: change.generation,
      attemptId: change.attemptId,
      credential: { ...credential(), keyVersion: 2 },
      now: NOW + 3_000,
    })
    const replayedGeneration = await beginPluginDomainCredentialChange(
      env.DB,
      user.id,
      { domainId: created.id, now: NOW + 4_000 }
    )
    await finalizePluginDomainCredentialChange(env.DB, user.id, {
      domainId: created.id,
      generation: replayedGeneration.generation,
      attemptId: replayedGeneration.attemptId,
      credential: { ...credential(), keyVersion: 3 },
      now: NOW + 5_000,
    })
    const finalizedTwiceDataVersion =
      await finalizePluginDomainCredentialChange(env.DB, user.id, {
        domainId: created.id,
        generation: replayedGeneration.generation,
        attemptId: replayedGeneration.attemptId,
        credential: { ...credential(), keyVersion: 4 },
        now: NOW + 6_000,
      })
    expect(finalizedTwiceDataVersion).toBeGreaterThan(0)

    const reassigned = await upsertPluginDomain(env.DB, user.id, {
      domain: "domain.example",
      pluginServerId: "server-1",
      pluginId: "plugin-2",
      now: NOW + 7_000,
    })
    expect(reassigned.id).toBe(created.id)
    const domainRow = await env.DB.prepare(
      "SELECT plugin_id, credential_generation FROM user_plugin_domains WHERE id = ?1"
    )
      .bind(reassigned.id)
      .first<{ plugin_id: string; credential_generation: number }>()
    expect(domainRow?.plugin_id).toBe("plugin-2")
    expect(domainRow?.credential_generation).toBe(
      replayedGeneration.generation + 1
    )
    const credentialRows = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM user_plugin_credentials WHERE plugin_domain_id = ?1"
    )
      .bind(reassigned.id)
      .first<{ count: number }>()
    expect(credentialRows?.count).toBe(0)

    await expectLedgerMatchesInventory(user.id)

    await deletePluginDomainCredential(env.DB, user.id, {
      domainId: created.id,
      now: NOW + 8_000,
    })
    listing = await listPluginDomains(env.DB, user.id)
    expect(listing[0]?.hasCredential).toBe(false)

    await deletePluginDomainById(env.DB, user.id, {
      domainId: created.id,
      now: NOW + 9_000,
    })
    const remaining = await listPluginDomains(env.DB, user.id)
    expect(remaining).toHaveLength(0)
    await expectLedgerMatchesInventory(user.id)
  })

  it("rejects invalid domains and wrong-user access", async () => {
    const owner = await createUser()
    const attacker = await createUser()
    const created = await upsertPluginDomain(env.DB, owner.id, {
      domain: "authz.example",
      pluginServerId: "server-1",
      pluginId: "plugin-1",
      now: NOW,
    })
    await expect(
      upsertPluginDomain(env.DB, owner.id, {
        domain: "",
        pluginServerId: "server-1",
        pluginId: "plugin-1",
        now: NOW,
      })
    ).rejects.toThrow("Domain is required")
    await expect(
      deletePluginDomainById(env.DB, attacker.id, {
        domainId: created.id,
        now: NOW,
      })
    ).rejects.toThrow("Plugin domain not found")
    await expect(
      setPluginDomainCredential(env.DB, attacker.id, {
        domainId: created.id,
        credential: credential(),
        now: NOW,
      })
    ).rejects.toThrow("Plugin domain not found")
  })
})

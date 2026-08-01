// @vitest-environment edge-runtime

import { api } from "../convex/_generated/api"
import {
  CUSTOM_PLUGIN_SERVER_REGISTRATION_LIMIT,
  PLUGIN_SERVER_REGISTRATION_TTL_MS,
} from "../convex/constants"
import {
  calculateAppOwnedStorageUsage,
  getUserStorageLedger,
} from "../convex/storagePolicy"
import {
  asAuthenticatedUser,
  createConvexTest,
  insertTestUser,
} from "./convex-test-harness"

const beginRegistration = (
  client: ReturnType<typeof asAuthenticatedUser>,
  index: number
) => {
  const baseUrl = `https://plugin-server-${index}.example`
  return client.mutation(api.userPluginServers.beginRegistration, {
    baseUrl,
  })
}

const finalizeRegistration = (
  client: ReturnType<typeof asAuthenticatedUser>,
  id: string,
  manifest = "{}"
) =>
  client.mutation(api.userPluginServers.finalizeEncryptedCredential, {
    id,
    manifest,
    apiKeyCiphertext: "ciphertext",
    apiKeyNonce: "nonce",
    apiKeyAlgorithm: "AES-256-GCM",
    apiKeyVersion: 1,
  })

describe("Convex Plugin Server lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("transactionally includes pending registrations in capacity", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "plugin-capacity-user")
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)

    const attempts = await Promise.allSettled(
      Array.from(
        { length: CUSTOM_PLUGIN_SERVER_REGISTRATION_LIMIT + 1 },
        (_, index) => beginRegistration(client, index)
      )
    )

    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled")
    ).toHaveLength(CUSTOM_PLUGIN_SERVER_REGISTRATION_LIMIT)
    expect(
      attempts.filter((attempt) => attempt.status === "rejected")
    ).toHaveLength(1)
    const rows = await convex.run((context) =>
      context.db
        .query("userPluginServers")
        .withIndex("by_userId", (queryBuilder) =>
          queryBuilder.eq("userId", user.userId)
        )
        .collect()
    )
    expect(rows).toHaveLength(CUSTOM_PLUGIN_SERVER_REGISTRATION_LIMIT)
    expect(rows.every((row) => row.credentialStatus === "pending")).toBe(true)
  })

  it("resumes a matching failed registration and prevents ready duplicates", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "plugin-retry-user")
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)
    const first = await beginRegistration(client, 0)

    await client.mutation(api.userPluginServers.markRegistrationFailed, {
      id: first.id,
      reason: "interrupted",
    })
    const resumed = await beginRegistration(client, 0)
    expect(resumed).toEqual({ id: first.id, resumed: true })

    await finalizeRegistration(client, resumed.id)
    await expect(beginRegistration(client, 0)).rejects.toThrow(
      "already registered"
    )
  })

  it("finalizes idempotently and records health transitions with an exact ledger", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "plugin-finalize-user")
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)
    const registration = await beginRegistration(client, 0)

    await finalizeRegistration(client, registration.id, '{"version":1}')
    await finalizeRegistration(client, registration.id, '{"version":1}')
    await client.mutation(api.userPluginServers.recordVerificationFailure, {
      id: registration.id,
    })
    const now = Date.now()
    await client.mutation(api.userPluginServers.recordVerificationSuccess, {
      id: registration.id,
      now,
    })
    await client.mutation(api.userPluginServers.recordRefreshSuccess, {
      id: registration.id,
      manifest: '{"version":2}',
      now: now + 1,
    })

    const result = await convex.run(async (context) => ({
      row: await context.db.get("userPluginServers", registration.id),
      ledger: await getUserStorageLedger(context, user.userId),
      inventory: await calculateAppOwnedStorageUsage(context, user.userId),
    }))
    expect(result.row).toMatchObject({
      credentialStatus: "ready",
      verificationStatus: "verified",
      manifest: '{"version":2}',
      lastManifestRefreshAt: now + 1,
    })
    expect(result.ledger).toMatchObject(result.inventory)
  })

  it("expires interrupted reservations and removes their exact storage", async () => {
    vi.useFakeTimers()
    const startedAt = new Date("2026-08-01T00:00:00.000Z")
    vi.setSystemTime(startedAt)
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "plugin-expiry-user")
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)
    const registration = await beginRegistration(client, 0)
    await client.mutation(api.userPluginServers.markRegistrationFailed, {
      id: registration.id,
      reason: "worker interrupted",
    })

    vi.setSystemTime(startedAt.getTime() + PLUGIN_SERVER_REGISTRATION_TTL_MS)
    await convex.finishAllScheduledFunctions(vi.runAllTimers)

    const result = await convex.run(async (context) => ({
      row: await context.db.get("userPluginServers", registration.id),
      ledger: await getUserStorageLedger(context, user.userId),
      inventory: await calculateAppOwnedStorageUsage(context, user.userId),
    }))
    expect(result.row).toBeNull()
    expect(result.ledger).toMatchObject(result.inventory)
    expect(result.ledger?.pluginServerBytes).toBe(0)
  })
})

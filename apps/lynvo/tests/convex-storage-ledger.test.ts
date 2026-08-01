// @vitest-environment edge-runtime

import { api } from "../convex/_generated/api"
import {
  calculateAppOwnedStorageUsage,
  getUserStorageLedger,
} from "../convex/storagePolicy"
import {
  asAuthenticatedUser,
  createConvexTest,
  insertTestUser,
} from "./convex-test-harness"

describe("Convex storage ledger", () => {
  it("reconstructs a missing ledger from every enforced storage domain", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "reconstruction-user")
    await convex.run(async (context) => {
      const now = Date.now()
      await context.db.insert("links", {
        userId: user.userId,
        url: "https://existing.example",
        createdAt: now,
        updatedAt: now,
      })
      await context.db.insert("userPluginServers", {
        userId: user.userId,
        baseUrl: "https://plugins.existing.example",
        credentialStatus: "pending",
        manifest: "{}",
        enabled: true,
        priority: 1,
        verificationStatus: "verified",
        createdAt: now,
        updatedAt: now,
      })
      const pluginDomainId = await context.db.insert("userPluginDomains", {
        userId: user.userId,
        pluginServerId: "server-1",
        pluginId: "plugin-1",
        domain: "existing.example",
      })
      await context.db.insert("userPluginCredentials", {
        userId: user.userId,
        pluginDomainId,
        pluginServerId: "server-1",
        pluginId: "plugin-1",
        domain: "existing.example",
        ciphertext: "ciphertext",
        nonce: "nonce",
        algorithm: "AES-256-GCM",
        keyVersion: 1,
        createdAt: now,
        updatedAt: now,
      })
    })
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)

    await client.mutation(api.links.createOrUpdate, {
      url: "https://new.example",
    })

    const result = await convex.run(async (context) => ({
      ledger: await getUserStorageLedger(context, user.userId),
      inventory: await calculateAppOwnedStorageUsage(context, user.userId),
    }))
    expect(result.ledger).toMatchObject(result.inventory)
    expect(result.ledger?.pluginServerBytes).toBeGreaterThan(0)
    expect(result.ledger?.pluginDomainBytes).toBeGreaterThan(0)
    expect(result.ledger?.pluginCredentialBytes).toBeGreaterThan(0)
    expect(result.ledger?.savedLinkCount).toBe(2)
  })

  it("repairs an outdated ledger before applying a new delta", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "version-repair-user")
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)
    const linkId = await client.mutation(api.links.createOrUpdate, {
      url: "https://version.example",
    })
    await convex.run(async (context) => {
      const ledger = await getUserStorageLedger(context, user.userId)
      if (!ledger) {
        throw new Error("Expected storage ledger")
      }
      await context.db.patch("userStorageLedgers", ledger._id, {
        schemaVersion: 0,
        recentLinkBytes: 0,
        savedLinkCount: 0,
        totalEnforcedBytes: ledger.profileBytes,
      })
    })

    await client.mutation(api.links.updateMeta, { id: linkId, meta: "{}" })

    const result = await convex.run(async (context) => ({
      ledger: await getUserStorageLedger(context, user.userId),
      inventory: await calculateAppOwnedStorageUsage(context, user.userId),
    }))
    expect(result.ledger).toMatchObject(result.inventory)
    expect(result.ledger?.schemaVersion).toBe(2)
  })

  it("tracks create, grow, shrink, and delete in the document transaction", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "ledger-user")
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)

    const linkId = await client.mutation(api.links.createOrUpdate, {
      url: "https://ledger.example/item",
      title: "Initial",
    })
    await client.mutation(api.links.updateMeta, {
      id: linkId,
      meta: JSON.stringify({ description: "A larger metadata value" }),
    })
    await client.mutation(api.links.updateMeta, {
      id: linkId,
      meta: "{}",
    })

    const beforeDelete = await convex.run(async (context) => ({
      ledger: await getUserStorageLedger(context, user.userId),
      inventory: await calculateAppOwnedStorageUsage(context, user.userId),
    }))
    expect(beforeDelete.ledger).toMatchObject(beforeDelete.inventory)
    expect(beforeDelete.ledger?.savedLinkCount).toBe(1)

    await client.mutation(api.links.deleteById, { id: linkId })
    const afterDelete = await convex.run(async (context) => ({
      ledger: await getUserStorageLedger(context, user.userId),
      inventory: await calculateAppOwnedStorageUsage(context, user.userId),
    }))
    expect(afterDelete.ledger).toMatchObject(afterDelete.inventory)
    expect(afterDelete.ledger?.savedLinkCount).toBe(0)

    const pluginServerId = await client.mutation(
      api.userPluginServers.createPending,
      {
        baseUrl: "https://plugin-server.ledger.example",
        manifest: "{}",
        enabled: true,
        priority: 1,
        verificationStatus: "verified",
      }
    )
    await client.mutation(api.userPluginServers.finalizeEncryptedCredential, {
      id: pluginServerId,
      apiKeyCiphertext: "ciphertext",
      apiKeyNonce: "nonce",
      apiKeyAlgorithm: "AES-256-GCM",
      apiKeyVersion: 1,
    })
    await client.mutation(api.userPluginServers.update, {
      id: pluginServerId,
      manifest: JSON.stringify({ name: "Larger manifest" }),
    })
    await client.mutation(api.userPluginServers.deleteById, {
      id: pluginServerId,
    })
    const afterWorkerDelete = await convex.run(async (context) => ({
      ledger: await getUserStorageLedger(context, user.userId),
      inventory: await calculateAppOwnedStorageUsage(context, user.userId),
    }))
    expect(afterWorkerDelete.ledger).toMatchObject(afterWorkerDelete.inventory)
  })

  it("tracks Plugin Domain and credential deltas through explicit domains", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "domain-ledger-user")
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)
    const assertLedgerMatches = async () => {
      const result = await convex.run(async (context) => ({
        ledger: await getUserStorageLedger(context, user.userId),
        inventory: await calculateAppOwnedStorageUsage(context, user.userId),
      }))
      expect(result.ledger).toMatchObject(result.inventory)
    }

    const domainId = await client.mutation(api.pluginDomains.create, {
      domain: "ledger-domain.example",
      pluginServerId: "server-1",
      pluginId: "plugin-1",
      credential: {
        ciphertext: "ciphertext",
        nonce: "nonce",
        algorithm: "AES-256-GCM",
        keyVersion: 1,
      },
    })
    await assertLedgerMatches()
    await client.mutation(api.pluginDomains.setCredential, {
      id: domainId,
      credential: {
        ciphertext: "larger-ciphertext-value",
        nonce: "new-nonce",
        algorithm: "AES-256-GCM",
        keyVersion: 2,
      },
    })
    await assertLedgerMatches()
    await client.mutation(api.pluginDomains.deleteCredential, { id: domainId })
    await assertLedgerMatches()
    await client.mutation(api.pluginDomains.deleteById, { id: domainId })
    await assertLedgerMatches()
  })

  it("rolls back both data and ledger when total quota rejects growth", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "quota-rollback-user")
    await convex.run(async (context) => {
      const now = Date.now()
      for (let serverIndex = 0; serverIndex < 4; serverIndex += 1) {
        await context.db.insert("userPluginServers", {
          userId: user.userId,
          baseUrl: `https://quota-${serverIndex}.example`,
          credentialStatus: "pending",
          manifest: "x".repeat(740_000),
          enabled: true,
          priority: serverIndex,
          verificationStatus: "verified",
          createdAt: now,
          updatedAt: now,
        })
      }
      const usage = await calculateAppOwnedStorageUsage(context, user.userId)
      await context.db.insert("userStorageLedgers", {
        userId: user.userId,
        schemaVersion: 2,
        ...usage,
        updatedAt: now,
      })
    })
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)
    const before = await convex.run(async (context) =>
      getUserStorageLedger(context, user.userId)
    )

    await expect(
      client.mutation(api.links.createOrUpdate, {
        url: "https://quota.example/rejected",
        meta: "x".repeat(300_000),
      })
    ).rejects.toThrow("Storage is full")

    const after = await convex.run(async (context) => ({
      ledger: await getUserStorageLedger(context, user.userId),
      links: await context.db
        .query("links")
        .withIndex("by_userId", (queryBuilder) =>
          queryBuilder.eq("userId", user.userId)
        )
        .take(1),
    }))
    expect(after.ledger).toEqual(before)
    expect(after.links).toEqual([])
  })

  it("rolls back the ledger when a storage mutation is rejected", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "rollback-ledger-user")
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)
    await client.mutation(api.links.createOrUpdate, {
      url: "https://ledger.example/original",
    })
    const before = await convex.run(async (context) =>
      getUserStorageLedger(context, user.userId)
    )

    await expect(
      client.mutation(api.links.createOrUpdate, {
        url: "https://ledger.example/rejected",
        meta: "x".repeat(1024 * 1024),
      })
    ).rejects.toThrow("too much data")
    const after = await convex.run(async (context) =>
      getUserStorageLedger(context, user.userId)
    )
    expect(after).toEqual(before)
  })
})

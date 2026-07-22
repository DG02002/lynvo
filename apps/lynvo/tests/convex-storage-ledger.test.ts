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

    const workerId = await client.mutation(api.userWorkers.create, {
      baseUrl: "https://worker.ledger.example",
      apiKey: "secret",
      manifest: "{}",
      enabled: true,
      priority: 1,
      verificationStatus: "verified",
    })
    await client.mutation(api.userWorkers.update, {
      id: workerId,
      manifest: JSON.stringify({ name: "Larger manifest" }),
    })
    await client.mutation(api.userWorkers.deleteById, { id: workerId })
    const afterWorkerDelete = await convex.run(async (context) => ({
      ledger: await getUserStorageLedger(context, user.userId),
      inventory: await calculateAppOwnedStorageUsage(context, user.userId),
    }))
    expect(afterWorkerDelete.ledger).toMatchObject(
      afterWorkerDelete.inventory
    )
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

import { describe, expect, it } from "vitest"
import { internal } from "../convex/_generated/api"
import { createConvexTest, insertTestUser } from "./convex-test-harness"

describe("managed extraction operations", () => {
  it("reserves the same operation once", async () => {
    const convex = createConvexTest()
    const { userId } = await insertTestUser(convex, "operation-owner")
    const arguments_ = {
      userId,
      operationId: "extract:one",
      pluginId: "direct-media" as const,
    }

    const first = await convex.mutation(
      internal.usage.reserveManagedExtraction,
      arguments_
    )
    const retry = await convex.mutation(
      internal.usage.reserveManagedExtraction,
      arguments_
    )

    expect(first).toMatchObject({ status: "reserved", dailyUsed: 1 })
    expect(retry).toEqual({ status: "already-reserved" })
    expect(
      await convex.run(
        async (context) => await context.db.query("usageCounters").collect()
      )
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ownerKey: `user:${userId}`,
          used: 1,
        }),
      ])
    )
  })

  it("releases pre-execution failures and consumes accepted attempts", async () => {
    const convex = createConvexTest()
    const { userId } = await insertTestUser(convex, "settlement-owner")
    const reserve = (operationId: string) =>
      convex.mutation(internal.usage.reserveManagedExtraction, {
        userId,
        operationId,
        pluginId: "direct-media",
      })

    await reserve("extract:released")
    await convex.mutation(internal.usage.settleManagedExtraction, {
      userId,
      operationId: "extract:released",
      outcome: "released",
    })
    await reserve("extract:consumed")
    await convex.mutation(internal.usage.settleManagedExtraction, {
      userId,
      operationId: "extract:consumed",
      outcome: "consumed",
    })

    const counters = await convex.run(
      async (context) => await context.db.query("usageCounters").collect()
    )
    expect(counters).toHaveLength(3)
    expect(counters.every((counter) => counter.used === 1)).toBe(true)
  })

  it("shares one 30-operation daily allowance across managed plugins", async () => {
    const convex = createConvexTest()
    const { userId } = await insertTestUser(convex, "daily-owner")
    const pluginIds = [
      "bhadoo-google-drive-index",
      "google-drive-public-files",
      "onedrive-index",
      "direct-media",
    ] as const

    for (let index = 0; index < 30; index += 1) {
      await convex.mutation(internal.usage.reserveManagedExtraction, {
        userId,
        operationId: `extract:${index}`,
        pluginId: pluginIds[index % pluginIds.length],
      })
    }

    await expect(
      convex.mutation(internal.usage.reserveManagedExtraction, {
        userId,
        operationId: "extract:31",
        pluginId: "direct-media",
      })
    ).rejects.toThrow("Daily Lynvo Plugin extraction limit reached.")
  })
})

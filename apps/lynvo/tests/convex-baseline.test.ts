// @vitest-environment edge-runtime

import { api, internal } from "../convex/_generated/api"
import {
  asAuthenticatedUser,
  createConvexTest,
  insertTestUser,
} from "./convex-test-harness"

describe("Convex function boundaries", () => {
  it("rejects anonymous Recent Link reads", async () => {
    const convex = createConvexTest()

    await expect(convex.query(api.links.list)).rejects.toThrow("UNAUTHORIZED")
  })

  it("isolates Recent Links by authenticated user", async () => {
    const convex = createConvexTest()
    const firstUser = await insertTestUser(convex, "first-user")
    const secondUser = await insertTestUser(convex, "second-user")

    await convex.run(async (context) => {
      const now = Date.now()
      await context.db.insert("links", {
        userId: firstUser.userId,
        url: "https://first.example",
        createdAt: now,
        updatedAt: now,
      })
      await context.db.insert("links", {
        userId: secondUser.userId,
        url: "https://second.example",
        createdAt: now,
        updatedAt: now,
      })
    })

    const firstUserClient = asAuthenticatedUser(
      convex,
      firstUser.userId,
      firstUser.sessionId
    )
    const links = await firstUserClient.query(api.links.list)

    expect(links).toHaveLength(1)
    expect(links[0]?.url).toBe("https://first.example")
  })

  it("enforces the real schema when inserting documents", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "schema-user")

    await expect(
      convex.run(async (context) => {
        await context.db.insert("links", {
          userId: user.userId,
          url: "https://schema.example",
          createdAt: "invalid",
          updatedAt: Date.now(),
        })
      })
    ).rejects.toThrow()
  })

  it("allows internal cleanup only through the internal API", async () => {
    const convex = createConvexTest()

    expectTypeOf(api.links).not.toHaveProperty("cleanupExpiredRecentCards")
    await expect(
      convex.mutation(internal.links.cleanupExpiredRecentCards)
    ).resolves.toEqual({ deletedLinks: 0 })
  })
})

// @vitest-environment edge-runtime

import { api, internal } from "../convex/_generated/api"
import {
  asAuthenticatedUser,
  createConvexTest,
  insertTestUser,
} from "./convex-test-harness"
import { RECENT_LINKS_MAX_COUNT } from "../convex/constants"

const LIST_TIME_BUCKET = Date.UTC(2026, 6, 22)

describe("Convex function boundaries", () => {
  it("rejects anonymous Recent Link reads", async () => {
    const convex = createConvexTest()

    await expect(
      convex.query(api.links.list, { timeBucket: LIST_TIME_BUCKET })
    ).rejects.toThrow("UNAUTHORIZED")
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
    const links = await firstUserClient.query(api.links.list, {
      timeBucket: LIST_TIME_BUCKET,
    })

    expect(links).toHaveLength(1)
    expect(links[0]?.url).toBe("https://first.example")
  })

  it("bounds Recent Links and atomically evicts the oldest unique URL", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "bounded-user")
    await convex.run(async (context) => {
      for (let index = 0; index < RECENT_LINKS_MAX_COUNT; index += 1) {
        await context.db.insert("links", {
          userId: user.userId,
          url: `https://bounded.example/${index}`,
          createdAt: LIST_TIME_BUCKET + index,
          updatedAt: LIST_TIME_BUCKET + index,
        })
      }
    })
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)

    await client.mutation(api.links.createOrUpdate, {
      url: "https://bounded.example/new",
    })
    const links = await client.query(api.links.list, {
      timeBucket: LIST_TIME_BUCKET + 1,
    })

    expect(links).toHaveLength(RECENT_LINKS_MAX_COUNT)
    expect(links[0]?.url).toBe("https://bounded.example/new")
    expect(links.some((link) => link.url === "https://bounded.example/0")).toBe(
      false
    )
  })

  it("updates an existing Recent Link without evicting another item", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "update-user")
    await convex.run(async (context) => {
      for (let index = 0; index < RECENT_LINKS_MAX_COUNT; index += 1) {
        await context.db.insert("links", {
          userId: user.userId,
          url: `https://update.example/${index}`,
          createdAt: LIST_TIME_BUCKET + index,
          updatedAt: LIST_TIME_BUCKET + index,
        })
      }
    })
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)

    await client.mutation(api.links.createOrUpdate, {
      url: "https://update.example/50",
      title: "Updated",
    })
    const links = await client.query(api.links.list, {
      timeBucket: LIST_TIME_BUCKET + 1,
    })

    expect(links).toHaveLength(RECENT_LINKS_MAX_COUNT)
    expect(links.find((link) => link.url.endsWith("/50"))?.title).toBe(
      "Updated"
    )
    expect(links.some((link) => link.url.endsWith("/0"))).toBe(true)
  })

  it("keeps eviction user-scoped and rolls back a rejected replacement", async () => {
    const convex = createConvexTest()
    const firstUser = await insertTestUser(convex, "eviction-user")
    const secondUser = await insertTestUser(convex, "isolated-user")
    await convex.run(async (context) => {
      for (let index = 0; index < RECENT_LINKS_MAX_COUNT; index += 1) {
        await context.db.insert("links", {
          userId: firstUser.userId,
          url: `https://eviction.example/${index}`,
          createdAt: LIST_TIME_BUCKET + index,
          updatedAt: LIST_TIME_BUCKET + index,
        })
      }
      await context.db.insert("links", {
        userId: secondUser.userId,
        url: "https://isolated.example/oldest",
        createdAt: LIST_TIME_BUCKET - 1,
        updatedAt: LIST_TIME_BUCKET - 1,
      })
    })
    const firstClient = asAuthenticatedUser(
      convex,
      firstUser.userId,
      firstUser.sessionId
    )
    const secondClient = asAuthenticatedUser(
      convex,
      secondUser.userId,
      secondUser.sessionId
    )

    await expect(
      firstClient.mutation(api.links.createOrUpdate, {
        url: "https://eviction.example/rejected",
        meta: "x".repeat(1024 * 1024),
      })
    ).rejects.toThrow("too much data")
    const afterRejection = await firstClient.query(api.links.list, {
      timeBucket: LIST_TIME_BUCKET + 1,
    })
    expect(afterRejection).toHaveLength(RECENT_LINKS_MAX_COUNT)
    expect(
      afterRejection.some((link) => link.url === "https://eviction.example/0")
    ).toBe(true)

    await firstClient.mutation(api.links.createOrUpdate, {
      url: "https://eviction.example/accepted",
    })
    const isolatedLinks = await secondClient.query(api.links.list, {
      timeBucket: LIST_TIME_BUCKET + 1,
    })
    expect(isolatedLinks.map((link) => link.url)).toEqual([
      "https://isolated.example/oldest",
    ])
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
      convex.mutation(internal.links.cleanupExpiredRecentCards, {
        paginationOpts: { cursor: null, numItems: 1 },
      })
    ).resolves.toEqual({
      continued: false,
      deletedLinks: 0,
      processedUsers: 0,
    })
  })
})

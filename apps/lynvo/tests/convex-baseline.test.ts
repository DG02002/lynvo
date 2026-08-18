// @vitest-environment edge-runtime

import { api, internal } from "../convex/_generated/api"
import {
  asAuthenticatedUser,
  createConvexTest,
  insertTestUser,
} from "./convex-test-harness"
import { EMPTY_LINK_METADATA_JSON, LINKS_MAX_COUNT } from "../convex/constants"

const LIST_TIME_BUCKET = Date.UTC(2026, 6, 22)

const createMetadataJson = (source: Record<string, unknown>) =>
  JSON.stringify({
    schemaVersion: 3,
    source,
    extraction: { extractedLinks: [] },
    playback: { openedUrls: [], openedIds: [], resolvedMirrors: {} },
  })

describe("Convex function boundaries", () => {
  it("stores account settings through the authenticated mutation", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "settings-revision-user")
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)

    await expect(
      client.query(api.users.getPlayerPreferences, {})
    ).resolves.toEqual({})
    await expect(
      client.mutation(api.users.updatePlayerPreferences, {
        rangeSupportedPlayerId: "just",
      })
    ).resolves.toEqual({ success: true })
    await expect(
      client.mutation(api.users.updatePlayerPreferences, {
        rangeUnsupportedPlayerId: "mpv",
      })
    ).resolves.toEqual({ success: true })
  })
  it("rejects anonymous link reads", async () => {
    const convex = createConvexTest()

    await expect(
      convex.query(api.links.list, { timeBucket: LIST_TIME_BUCKET })
    ).rejects.toThrow("UNAUTHORIZED")
  })

  it("rejects noncanonical metadata before committing a link", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "invalid-metadata-user")
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)

    await expect(
      client.mutation(api.links.createOrUpdate, {
        operationId: crypto.randomUUID(),
        url: "https://invalid.example",
        meta: "{}",
      })
    ).rejects.toThrow()

    await expect(
      client.query(api.links.list, { timeBucket: LIST_TIME_BUCKET })
    ).resolves.toEqual({ results: [] })
  })

  it("isolates links by authenticated user", async () => {
    const convex = createConvexTest()
    const firstUser = await insertTestUser(convex, "first-user")
    const secondUser = await insertTestUser(convex, "second-user")

    await convex.run(async (context) => {
      const now = Date.now()
      await context.db.insert("links", {
        userId: firstUser.userId,
        url: "https://first.example",
        meta: EMPTY_LINK_METADATA_JSON,
        createdAt: now,
        updatedAt: now,
      })
      await context.db.insert("links", {
        userId: secondUser.userId,
        url: "https://second.example",
        meta: EMPTY_LINK_METADATA_JSON,
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

    expect(links.results).toHaveLength(1)
    expect(links.results[0]?.url).toBe("https://first.example")
  })

  it("bounds links and atomically evicts the oldest unique URL", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "bounded-user")
    await convex.run(async (context) => {
      for (let index = 0; index < LINKS_MAX_COUNT; index += 1) {
        await context.db.insert("links", {
          userId: user.userId,
          url: `https://bounded.example/${index}`,
          meta: EMPTY_LINK_METADATA_JSON,
          createdAt: LIST_TIME_BUCKET + index,
          updatedAt: LIST_TIME_BUCKET + index,
        })
      }
    })
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)

    await client.mutation(api.links.createOrUpdate, {
      operationId: crypto.randomUUID(),
      url: "https://bounded.example/new",
    })
    const links = await client.query(api.links.list, {
      timeBucket: LIST_TIME_BUCKET + 1,
    })

    expect(links.results).toHaveLength(LINKS_MAX_COUNT)
    expect(links.results[0]?.url).toBe("https://bounded.example/new")
    expect(
      links.results.some((link) => link.url === "https://bounded.example/0")
    ).toBe(false)
  })

  it("updates an existing link without evicting another item", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "update-user")
    await convex.run(async (context) => {
      for (let index = 0; index < LINKS_MAX_COUNT; index += 1) {
        await context.db.insert("links", {
          userId: user.userId,
          url: `https://update.example/${index}`,
          meta: EMPTY_LINK_METADATA_JSON,
          createdAt: LIST_TIME_BUCKET + index,
          updatedAt: LIST_TIME_BUCKET + index,
        })
      }
    })
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)

    await client.mutation(api.links.createOrUpdate, {
      operationId: crypto.randomUUID(),
      url: "https://update.example/50",
      title: "Updated",
    })
    const links = await client.query(api.links.list, {
      timeBucket: LIST_TIME_BUCKET + 1,
    })

    expect(links.results).toHaveLength(LINKS_MAX_COUNT)
    expect(links.results.find((link) => link.url.endsWith("/50"))?.title).toBe(
      "Updated"
    )
    expect(links.results.some((link) => link.url.endsWith("/0"))).toBe(true)
  })

  it("keeps eviction user-scoped and rolls back a rejected replacement", async () => {
    const convex = createConvexTest()
    const firstUser = await insertTestUser(convex, "eviction-user")
    const secondUser = await insertTestUser(convex, "isolated-user")
    await convex.run(async (context) => {
      for (let index = 0; index < LINKS_MAX_COUNT; index += 1) {
        await context.db.insert("links", {
          userId: firstUser.userId,
          url: `https://eviction.example/${index}`,
          meta: EMPTY_LINK_METADATA_JSON,
          createdAt: LIST_TIME_BUCKET + index,
          updatedAt: LIST_TIME_BUCKET + index,
        })
      }
      await context.db.insert("links", {
        userId: secondUser.userId,
        url: "https://isolated.example/oldest",
        meta: EMPTY_LINK_METADATA_JSON,
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
        operationId: crypto.randomUUID(),
        url: "https://eviction.example/rejected",
        meta: createMetadataJson({ padding: "x".repeat(1024 * 1024) }),
      })
    ).rejects.toMatchObject({
      data: {
        kind: "link-too-large",
        limitBytes: 262_144,
      },
    })
    const afterRejection = await firstClient.query(api.links.list, {
      timeBucket: LIST_TIME_BUCKET + 1,
    })
    expect(afterRejection.results).toHaveLength(LINKS_MAX_COUNT)
    expect(
      afterRejection.results.some(
        (link) => link.url === "https://eviction.example/0"
      )
    ).toBe(true)

    await firstClient.mutation(api.links.createOrUpdate, {
      operationId: crypto.randomUUID(),
      url: "https://eviction.example/accepted",
    })
    const isolatedLinks = await secondClient.query(api.links.list, {
      timeBucket: LIST_TIME_BUCKET + 1,
    })
    expect(isolatedLinks.results.map((link) => link.url)).toEqual([
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
          meta: EMPTY_LINK_METADATA_JSON,
          createdAt: "invalid",
          updatedAt: Date.now(),
        })
      })
    ).rejects.toThrow()
  })

  it("allows internal cleanup only through the internal API", async () => {
    const convex = createConvexTest()

    expectTypeOf(api.links).not.toHaveProperty("cleanupExpiredLinks")
    await expect(
      convex.mutation(internal.links.cleanupExpiredLinks, {
        paginationOpts: { cursor: null, numItems: 1 },
      })
    ).resolves.toEqual({
      continued: false,
      deletedLinks: 0,
      processedUsers: 0,
    })
  })

  it("applies create, update, and delete mutations", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "revision-user")
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)
    const created = await client.mutation(api.links.createOrUpdate, {
      operationId: crypto.randomUUID(),
      url: "https://revision.example",
    })
    expect(created.id).toBeDefined()
    const updated = await client.mutation(api.links.updateMeta, {
      operationId: crypto.randomUUID(),
      id: created.id,
      meta: EMPTY_LINK_METADATA_JSON,
    })
    expect(updated).toEqual({ success: true })
    const deleted = await client.mutation(api.links.deleteById, {
      id: created.id,
    })
    expect(deleted).toEqual({ success: true })
  })
})

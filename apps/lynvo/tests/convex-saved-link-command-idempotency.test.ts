import { describe, expect, it } from "vitest"
import { api } from "../convex/_generated/api"
import {
  asAuthenticatedUser,
  createConvexTest,
  insertTestUser,
} from "./convex-test-harness"

describe("saved-link command idempotency", () => {
  it("creates once when an operation is replayed after a lost response", async () => {
    const convex = createConvexTest()
    const { userId, sessionId } = await insertTestUser(convex, "retry-owner")
    const client = asAuthenticatedUser(convex, userId, sessionId)
    const command = {
      operationId: "create:one",
      url: "https://example.com/one",
      title: "One",
    }

    const first = await client.mutation(api.links.createOrUpdate, command)
    const retry = await client.mutation(api.links.createOrUpdate, command)
    const snapshot = await client.query(api.links.list, {
      timeBucket: Date.now(),
    })

    expect(retry).toEqual(first)
    expect(snapshot.results).toHaveLength(1)
  })

  it("updates once when an operation is replayed after a lost response", async () => {
    const convex = createConvexTest()
    const { userId, sessionId } = await insertTestUser(convex, "update-owner")
    const client = asAuthenticatedUser(convex, userId, sessionId)
    const created = await client.mutation(api.links.createOrUpdate, {
      operationId: "create:update-target",
      url: "https://example.com/update-target",
    })
    const command = {
      operationId: "update:one",
      id: created.id,
      meta: JSON.stringify({
        schemaVersion: 3,
        source: { title: "Updated" },
        extraction: { extractedLinks: [] },
        playback: { openedUrls: [], openedIds: [] },
      }),
    }

    const first = await client.mutation(api.links.updateMeta, command)
    const retry = await client.mutation(api.links.updateMeta, command)
    expect(retry).toEqual(first)
    expect(retry).toEqual({ success: true })
  })
})

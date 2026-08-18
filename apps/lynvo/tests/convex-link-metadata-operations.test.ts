// @vitest-environment edge-runtime

import { api } from "../convex/_generated/api"
import {
  asAuthenticatedUser,
  createConvexTest,
  insertTestUser,
} from "./convex-test-harness"
import type { ExtractedLink } from "../app/features/links/types"

const playableLink: ExtractedLink = {
  nodeKey: "file:one",
  url: "https://media.example/one.mp4",
  label: "One",
  type: "file",
  mediaNodeKind: "playable",
}

const createMetadataJson = () =>
  JSON.stringify({
    schemaVersion: 3,
    source: {},
    extraction: { extractedLinks: [playableLink] },
    playback: { openedUrls: [], openedIds: [], resolvedMirrors: {} },
  })

describe("semantic saved-link metadata operations", () => {
  it("preserves opened state and mirrors in either commit order", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "semantic-link-user")
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)
    const { id } = await client.mutation(api.links.createOrUpdate, {
      operationId: crypto.randomUUID(),
      url: "https://source.example",
      meta: createMetadataJson(),
    })

    await client.mutation(api.links.applyMetadataOperation, {
      operationId: crypto.randomUUID(),
      id,
      operation: {
        kind: "cacheMirrors",
        lazyItemUrl: "https://lazy.example",
        mirrorsJson: JSON.stringify([playableLink]),
      },
    })
    await client.mutation(api.links.applyMetadataOperation, {
      operationId: crypto.randomUUID(),
      id,
      operation: { kind: "markOpened", linkUrl: playableLink.url },
    })

    const stored = await convex.run((context) => context.db.get("links", id))
    expect(stored).not.toBeNull()
    const metadata = JSON.parse(stored?.meta ?? "")
    expect(metadata.playback.openedUrls).toEqual([playableLink.url])
    expect(metadata.playback.resolvedMirrors["https://lazy.example"]).toEqual([
      playableLink,
    ])
  })

  it("does not resurrect a removed child and rejects stale replacement", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "semantic-remove-user")
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)
    const { id } = await client.mutation(api.links.createOrUpdate, {
      operationId: crypto.randomUUID(),
      url: "https://source.example",
      meta: createMetadataJson(),
    })

    await client.mutation(api.links.applyMetadataOperation, {
      operationId: crypto.randomUUID(),
      id,
      operation: {
        kind: "removeExtractedLink",
        linkKey: playableLink.nodeKey,
        linkUrl: playableLink.url,
      },
    })
    await client.mutation(api.links.applyMetadataOperation, {
      operationId: crypto.randomUUID(),
      id,
      operation: { kind: "markOpened", linkUrl: playableLink.url },
    })
    await expect(
      client.mutation(api.links.applyMetadataOperation, {
        operationId: crypto.randomUUID(),
        id,
        operation: {
          kind: "replaceExtraction",
          expectedExtractionJson: JSON.stringify([playableLink]),
          extractedLinksJson: JSON.stringify([playableLink]),
        },
      })
    ).rejects.toThrow("extraction changed")

    const stored = await convex.run((context) => context.db.get("links", id))
    expect(stored).not.toBeNull()
    const metadata = JSON.parse(stored?.meta ?? "")
    expect(metadata.extraction.extractedLinks).toEqual([])
  })

  it("clears cached mirrors when replacing source extraction", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "semantic-refresh-user")
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)
    const { id } = await client.mutation(api.links.createOrUpdate, {
      operationId: crypto.randomUUID(),
      url: "https://source.example",
      meta: createMetadataJson(),
    })

    await client.mutation(api.links.applyMetadataOperation, {
      operationId: crypto.randomUUID(),
      id,
      operation: {
        kind: "cacheMirrors",
        lazyItemUrl: "https://lazy.example",
        mirrorsJson: JSON.stringify([{ ...playableLink, size: "1 GB" }]),
      },
    })
    await client.mutation(api.links.applyMetadataOperation, {
      operationId: crypto.randomUUID(),
      id,
      operation: {
        kind: "replaceExtraction",
        expectedExtractionJson: JSON.stringify([playableLink]),
        extractedLinksJson: JSON.stringify([playableLink]),
      },
    })

    const stored = await convex.run((context) => context.db.get("links", id))
    const metadata = JSON.parse(stored?.meta ?? "")
    expect(metadata.playback.resolvedMirrors).toEqual({})
  })
})

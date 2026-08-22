import { describe, expect, it } from "vitest"
import {
  createLinksSnapshotStore,
} from "~/features/links/use-links/links-store"
import type { LinkViewItem } from "~/features/links/types"

const viewItem = (
  id: string,
  overrides: Partial<LinkViewItem> = {}
): LinkViewItem => ({
  id,
  url: `https://example.com/${id}`,
  timestamp: 1,
  metadata: {
    schemaVersion: 3,
    source: {},
    extraction: { extractedLinks: [] },
    playback: { openedUrls: [], openedIds: [] },
  },
  ...overrides,
})

describe("links snapshot store", () => {
  it("applies server snapshots keyed by server-assigned IDs", () => {
    const store = createLinksSnapshotStore()

    expect(store.applyServerSnapshot([viewItem("b"), viewItem("a")], 4)).toBe(
      true
    )
    expect(store.getVersion()).toBe(4)
    expect(store.getSnapshot().map((item) => item.id)).toEqual(["b", "a"])
  })

  it("ignores stale snapshots", () => {
    const store = createLinksSnapshotStore()
    store.applyServerSnapshot([viewItem("new")], 7)

    expect(store.applyServerSnapshot([viewItem("old")], 3)).toBe(false)
    expect(store.getSnapshot().map((item) => item.id)).toEqual(["new"])
  })

  it("prepends temporary adds and settles them on the server response", () => {
    const store = createLinksSnapshotStore()
    store.applyServerSnapshot([viewItem("existing")], 2)

    const temporaryItem = store.beginAdd(viewItem("", { url: "https://example.com/fresh" }))
    expect(temporaryItem.id).toMatch(/^temp:/)
    expect(store.getSnapshot()[0]?.url).toBe("https://example.com/fresh")

    store.settleAdd(temporaryItem.id, "fresh", 3)
    expect(store.getSnapshot()[0]?.id).toBe("fresh")

    store.applyServerSnapshot([viewItem("existing"), viewItem("fresh")], 3)
    expect(store.getSnapshot().map((item) => item.id)).toEqual([
      "existing",
      "fresh",
    ])
  })

  it("drops a pending add once a newer snapshot contains its URL", () => {
    const store = createLinksSnapshotStore()
    store.applyServerSnapshot([], 2)

    store.beginAdd(viewItem("", { url: "https://example.com/dup" }))
    expect(store.getSnapshot()).toHaveLength(1)

    store.applyServerSnapshot([viewItem("dup")], 3)
    expect(store.getSnapshot().map((item) => item.id)).toEqual(["dup"])
  })

  it("discards a failed add immediately", () => {
    const store = createLinksSnapshotStore()
    store.applyServerSnapshot([], 1)

    const temporaryItem = store.beginAdd(viewItem(""))
    store.discardPendingAdd(temporaryItem.id)

    expect(store.getSnapshot()).toHaveLength(0)
  })

  it("keeps optimistic updates until a newer snapshot lands", () => {
    const store = createLinksSnapshotStore()
    store.applyServerSnapshot([viewItem("one")], 5)

    const updated = store.beginUpdate("one", (item) => ({
      ...item,
      title: "Optimistic title",
    }))
    expect(updated?.title).toBe("Optimistic title")
    expect(store.getSnapshot()[0]?.title).toBe("Optimistic title")

    store.applyServerSnapshot(
      [viewItem("one", { title: undefined })],
      5
    )
    expect(store.getSnapshot()[0]?.title).toBe("Optimistic title")

    store.applyServerSnapshot([viewItem("one")], 6)
    expect(store.getSnapshot()[0]?.title).toBeUndefined()
  })

  it("hides removed items until a newer snapshot confirms the removal", () => {
    const store = createLinksSnapshotStore()
    store.applyServerSnapshot([viewItem("keep"), viewItem("gone")], 3)

    expect(store.beginRemove("gone")).toBe(true)
    expect(store.beginRemove("missing")).toBe(false)
    expect(store.getSnapshot().map((item) => item.id)).toEqual(["keep"])

    store.applyServerSnapshot([viewItem("keep")], 4)
    expect(store.getSnapshot().map((item) => item.id)).toEqual(["keep"])
  })

  it("hides everything after a clear and recovers on the next snapshot", () => {
    const store = createLinksSnapshotStore()
    store.applyServerSnapshot([viewItem("one")], 2)

    store.beginClear()
    expect(store.getSnapshot()).toHaveLength(0)

    store.resetOverlayToServerSnapshot()
    expect(store.getSnapshot().map((item) => item.id)).toEqual(["one"])

    store.beginClear()
    store.applyServerSnapshot([], 3)
    expect(store.getSnapshot()).toHaveLength(0)
  })
})

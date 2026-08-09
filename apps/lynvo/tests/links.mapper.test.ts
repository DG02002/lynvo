import { describe, expect, it } from "vitest"
import {
  parseLinkMetadata,
  toLinkViewModel,
  toLinkViewItem,
  toSavedLinkDTO,
  createLinkMetadata,
  mergeDefinedMeta,
} from "../app/features/links/links.mapper"
import type { LinkResponse } from "../app/features/links/types"

const playableLink = (id: string, url: string, label: string) => ({
  nodeKey: `test:${id}`,
  id,
  url,
  label,
  type: "file" as const,
  mediaNodeKind: "playable" as const,
})

describe("links mapper metadata boundary", () => {
  it("rejects invalid JSON metadata", () => {
    expect(() => parseLinkMetadata("not-json")).toThrow()
  })

  it("accepts the canonical persisted shape", () => {
    const metadata = parseLinkMetadata(
      JSON.stringify({
        schemaVersion: 3,
        source: { pluginName: "Plugin", badge: "Variant Alpha" },
        extraction: {
          extractedLinks: [playableLink("a", "https://a.test", "A")],
        },
        playback: { openedUrls: ["https://a.test"], openedIds: ["a"] },
      })
    )

    expect(metadata.source.pluginName).toBe("Plugin")
    expect(metadata.source.badge).toBe("Variant Alpha")
    expect(metadata.playback.openedUrls).toEqual(["https://a.test"])
  })

  it("rejects non-canonical persistence fields", () => {
    expect(() =>
      parseLinkMetadata({
        pluginName: "Plugin",
        extractedLinks: [],
      })
    ).toThrow()
  })

  it("preserves current metadata and derives opened view state", () => {
    const row: LinkResponse = {
      id: "1",
      url: "https://page.test",
      title: "Page",
      created_at: 1,
      updated_at: 2,
      meta: {
        schemaVersion: 3,
        source: { pluginName: "Plugin", badge: "4K" },
        extraction: {
          extractedLinks: [playableLink("x", "https://x.test", "X")],
        },
        playback: { openedUrls: ["https://x.test"], openedIds: [] },
      },
    }

    const item = toLinkViewItem(toSavedLinkDTO(row))
    const view = toLinkViewModel(item)
    expect(view.badge).toBe("4K")
    expect(view.extractedLinks[0].opened).toBe(true)
  })
})

describe("save-flow metadata preservation", () => {
  it("preserves pluginServerId and opened state when updating extracted links", () => {
    const previous = createLinkMetadata({
      meta: {
        pluginName: "Plugin Server",
        pluginServerId: "plugin-server-1",
      },
      extractedLinks: [playableLink("old", "https://old.test", "Old")],
    })
    previous.playback.openedUrls = ["https://old.test"]
    previous.playback.openedIds = ["old"]

    const updated = createLinkMetadata({
      extractedLinks: [playableLink("new", "https://new.test", "New")],
      previous,
    })

    expect(
      (updated.source as Record<string, string | undefined>).pluginServerId
    ).toBe("plugin-server-1")
    expect(updated.playback.openedUrls).toContain("https://old.test")
    expect(updated.playback.openedIds).toContain("old")
  })

  it("preserves Plugin Server source identity metadata", () => {
    const metadata = createLinkMetadata({
      meta: {
        pluginName: "Example Plugin Server",
        pluginIcon: "https://plugin-server.example/icon.svg",
        pluginId: "resolver-beta",
        sourceName: "Resolver Beta",
        sourceIconUrl: "https://icons.example/resolver-beta.svg",
        sourceStatus: "active",
        sourceVersion: "1.0.0",
        pluginServerId: "plugin-server-1",
      },
      extractedLinks: [playableLink("link", "https://cdn.test", "CDN")],
    })

    const item = toLinkViewItem(
      toSavedLinkDTO({
        id: "1",
        url: "https://source.test",
        created_at: 1,
        meta: metadata,
      })
    )
    const view = toLinkViewModel(item)

    expect(metadata.source.pluginId).toBe("resolver-beta")
    expect(metadata.source.sourceName).toBe("Resolver Beta")
    expect(metadata.source.sourceIconUrl).toBe(
      "https://icons.example/resolver-beta.svg"
    )
    expect(metadata.source.sourceStatus).toBe("active")
    expect(metadata.source.sourceVersion).toBe("1.0.0")
    expect(view.sourceName).toBe("Resolver Beta")
    expect(view.sourceIconUrl).toBe("https://icons.example/resolver-beta.svg")
    expect(view.sourceStatus).toBe("active")
    expect(view.sourceVersion).toBe("1.0.0")
  })

  it("preserves pluginServerId from previous metadata when meta is omitted", () => {
    const previous = createLinkMetadata({
      meta: {
        pluginName: "Plugin Server",
        pluginServerId: "plugin-server-1",
      },
      extractedLinks: [],
    })

    const updated = createLinkMetadata({
      extractedLinks: [playableLink("new", "https://new.test", "New")],
      previous,
    })

    expect(
      (updated.source as Record<string, string | undefined>).pluginServerId
    ).toBe("plugin-server-1")
  })

  it("does not erase manifest source metadata with undefined extraction metadata", () => {
    const merged = mergeDefinedMeta(
      {
        pluginName: "Example Plugin Server",
        pluginId: "resolver-beta",
        sourceName: "Resolver Beta",
        sourceIconUrl:
          "https://plugin-server.example/icons/sources/resolver-beta.webp",
        sourceStatus: "active",
        sourceVersion: "1.0.0",
      },
      {
        pluginId: "resolver-beta",
        sourceName: "Resolver Beta",
        sourceIconUrl: undefined,
      }
    )

    expect(merged.sourceIconUrl).toBe(
      "https://plugin-server.example/icons/sources/resolver-beta.webp"
    )
    expect(merged.sourceStatus).toBe("active")
    expect(merged.sourceVersion).toBe("1.0.0")
  })
})

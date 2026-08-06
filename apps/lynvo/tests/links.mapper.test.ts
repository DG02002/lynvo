import { describe, expect, it } from "vitest"
import {
  normalizeLinkMetadata,
  toLinkViewModel,
  toLinkViewItem,
  toSavedLinkDTO,
  createLinkMetadata,
  mergeDefinedMeta,
} from "../app/features/links/links.mapper"
import type { LinkResponse } from "../app/features/links/types"

describe("links mapper metadata normalization", () => {
  it("handles invalid JSON metadata", () => {
    const metadata = normalizeLinkMetadata("not-json")
    expect(metadata.schemaVersion).toBe(3)
    expect(metadata.extraction.extractedLinks).toEqual([])
    expect(metadata.playback.openedUrls).toEqual([])
  })

  it("normalizes flat meta strings and opened flags", () => {
    const metadata = normalizeLinkMetadata(
      JSON.stringify({
        pluginName: "Plugin",
        pluginIcon: "icon.png",
        password: "secret",
        badge: "Variant Alpha",
        extractedLinks: [
          { id: "a", url: "https://a.test", label: "A", opened: true },
          {
            id: "folder",
            url: "https://folder.test",
            label: "Folder",
            type: "folder",
            children: [
              { id: "b", url: "https://b.test", label: "B", opened: true },
            ],
          },
        ],
      })
    )

    expect(metadata.source.pluginName).toBe("Plugin")
    expect(metadata.source.pluginIcon).toBe("icon.png")
    expect(metadata.source.password).toBeUndefined()
    expect(metadata.source.badge).toBe("Variant Alpha")
    expect(metadata.playback.openedUrls).toEqual([
      "https://a.test",
      "https://b.test",
    ])
    expect(metadata.playback.openedIds).toEqual(["a", "b"])
    expect(metadata.extraction.extractedLinks[0].opened).toBeUndefined()
    expect(
      metadata.extraction.extractedLinks[1].children?.[0].opened
    ).toBeUndefined()
  })

  it("does not retain playback positions or resume state", () => {
    const metadata = normalizeLinkMetadata({
      schemaVersion: 3,
      source: {},
      extraction: { extractedLinks: [] },
      playback: {
        openedUrls: ["https://video.test/file"],
        openedIds: ["file"],
        position: 120,
        resumeState: { position: 120 },
      },
    })

    expect(metadata.playback).toEqual({
      openedUrls: ["https://video.test/file"],
      openedIds: ["file"],
      resolvedMirrors: {},
    })
  })

  it("accepts top-level extractedLinks", () => {
    const metadata = normalizeLinkMetadata({}, [
      { id: "top", url: "https://top.test", label: "Top" },
    ])
    expect(metadata.extraction.extractedLinks).toHaveLength(1)
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
          extractedLinks: [{ id: "x", url: "https://x.test", label: "X" }],
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
    const previous = normalizeLinkMetadata({
      pluginName: "Plugin Server",
      pluginServerId: "plugin-server-1",
      extractedLinks: [{ id: "old", url: "https://old.test", label: "Old" }],
    })
    previous.playback.openedUrls = ["https://old.test"]
    previous.playback.openedIds = ["old"]

    const updated = createLinkMetadata({
      extractedLinks: [{ id: "new", url: "https://new.test", label: "New" }],
      previous,
    })

    expect(
      (updated.source as Record<string, string | undefined>).pluginServerId
    ).toBe("plugin-server-1")
    expect(updated.playback.openedUrls).toContain("https://old.test")
    expect(updated.playback.openedIds).toContain("old")
  })

  it("preserves Plugin Server source identity metadata", () => {
    const metadata = normalizeLinkMetadata({
      pluginName: "Example Plugin Server",
      pluginIcon: "https://plugin-server.example/icon.svg",
      pluginId: "resolver-beta",
      sourceName: "Resolver Beta",
      sourceIconUrl: "https://icons.example/resolver-beta.svg",
      sourceStatus: "active",
      sourceVersion: "1.0.0",
      pluginServerId: "plugin-server-1",
      extractedLinks: [{ id: "link", url: "https://cdn.test", label: "CDN" }],
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
    const previous = normalizeLinkMetadata({
      pluginName: "Plugin Server",
      pluginServerId: "plugin-server-1",
      extractedLinks: [],
    })

    const updated = createLinkMetadata({
      extractedLinks: [{ url: "https://new.test", label: "New" }],
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

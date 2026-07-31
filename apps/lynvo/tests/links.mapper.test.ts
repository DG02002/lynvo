import { describe, expect, it } from "vitest"
import {
  normalizeLinkMetadata,
  toRecentLinkViewModel,
  toRecentLinkViewItem,
  toSavedLinkDTO,
  createMetadataV2,
  mergeDefinedMeta,
} from "../app/features/links/links.mapper"
import type { LinkResponse } from "../app/features/links/types"

describe("links mapper legacy normalization", () => {
  it("handles invalid JSON metadata", () => {
    const metadata = normalizeLinkMetadata("not-json")
    expect(metadata.schemaVersion).toBe(2)
    expect(metadata.extraction.extractedLinks).toEqual([])
    expect(metadata.playback.watchedUrls).toEqual([])
  })

  it("normalizes legacy meta strings and watched flags", () => {
    const metadata = normalizeLinkMetadata(
      JSON.stringify({
        pluginName: "Plugin",
        pluginIcon: "icon.png",
        password: "secret",
        badge: "Variant Alpha",
        extractedLinks: [
          { id: "a", url: "https://a.test", label: "A", watched: true },
          {
            id: "folder",
            url: "https://folder.test",
            label: "Folder",
            type: "folder",
            children: [
              { id: "b", url: "https://b.test", label: "B", watched: true },
            ],
          },
        ],
      })
    )

    expect(metadata.source.pluginName).toBe("Plugin")
    expect(metadata.source.pluginIcon).toBe("icon.png")
    expect(metadata.source.password).toBeUndefined()
    expect(metadata.source.badge).toBe("Variant Alpha")
    expect(metadata.playback.watchedUrls).toEqual([
      "https://a.test",
      "https://b.test",
    ])
    expect(metadata.playback.watchedIds).toEqual(["a", "b"])
    expect(metadata.extraction.extractedLinks[0].watched).toBeUndefined()
    expect(
      metadata.extraction.extractedLinks[1].children?.[0].watched
    ).toBeUndefined()
  })

  it("accepts top-level legacy extractedLinks", () => {
    const metadata = normalizeLinkMetadata({}, [
      { id: "top", url: "https://top.test", label: "Top" },
    ])
    expect(metadata.extraction.extractedLinks).toHaveLength(1)
  })

  it("preserves V2 metadata and derives watched view state", () => {
    const row: LinkResponse = {
      id: "1",
      url: "https://page.test",
      title: "Page",
      created_at: 1,
      updated_at: 2,
      meta: {
        schemaVersion: 2,
        source: { pluginName: "Plugin", badge: "4K" },
        extraction: {
          extractedLinks: [{ id: "x", url: "https://x.test", label: "X" }],
        },
        playback: { watchedUrls: ["https://x.test"], watchedIds: [] },
      },
    }

    const item = toRecentLinkViewItem(toSavedLinkDTO(row))
    const view = toRecentLinkViewModel(item)
    expect(view.badge).toBe("4K")
    expect(view.extractedLinks[0].watched).toBe(true)
  })
})

describe("save-flow metadata preservation", () => {
  it("preserves workerId and watched state when updating extracted links", () => {
    const previous = normalizeLinkMetadata({
      pluginName: "Worker",
      workerId: "worker-1",
      extractedLinks: [{ id: "old", url: "https://old.test", label: "Old" }],
    })
    previous.playback.watchedUrls = ["https://old.test"]
    previous.playback.watchedIds = ["old"]

    const updated = createMetadataV2({
      extractedLinks: [{ id: "new", url: "https://new.test", label: "New" }],
      previous,
    })

    expect(
      (updated.source as Record<string, string | undefined>).workerId
    ).toBe("worker-1")
    expect(updated.playback.watchedUrls).toContain("https://old.test")
    expect(updated.playback.watchedIds).toContain("old")
  })

  it("preserves worker source identity metadata", () => {
    const metadata = normalizeLinkMetadata({
      pluginName: "Example Extractor",
      pluginIcon: "https://worker.example/icon.svg",
      pluginId: "resolver-beta",
      sourceName: "Resolver Beta",
      sourceIconUrl: "https://icons.example/resolver-beta.svg",
      sourceStatus: "active",
      sourceVersion: "1.0.0",
      workerId: "worker-1",
      extractedLinks: [{ id: "link", url: "https://cdn.test", label: "CDN" }],
    })

    const item = toRecentLinkViewItem(
      toSavedLinkDTO({
        id: "1",
        url: "https://source.test",
        created_at: 1,
        meta: metadata,
      })
    )
    const view = toRecentLinkViewModel(item)

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

  it("preserves workerId from previous metadata when meta is omitted", () => {
    const previous = normalizeLinkMetadata({
      pluginName: "Worker",
      workerId: "worker-1",
      extractedLinks: [],
    })

    const updated = createMetadataV2({
      extractedLinks: [{ url: "https://new.test", label: "New" }],
      previous,
    })

    expect(
      (updated.source as Record<string, string | undefined>).workerId
    ).toBe("worker-1")
  })

  it("does not erase manifest source metadata with undefined extraction metadata", () => {
    const merged = mergeDefinedMeta(
      {
        pluginName: "Example Extractor",
        pluginId: "resolver-beta",
        sourceName: "Resolver Beta",
        sourceIconUrl:
          "https://worker.example/icons/sources/resolver-beta.webp",
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
      "https://worker.example/icons/sources/resolver-beta.webp"
    )
    expect(merged.sourceStatus).toBe("active")
    expect(merged.sourceVersion).toBe("1.0.0")
  })
})

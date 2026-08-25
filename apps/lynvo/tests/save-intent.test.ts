import { beforeEach, describe, expect, it, vi } from "vitest"
import { extractionOrchestration } from "~/lib/extraction/orchestration"
import type { ExtractedLink, LinkViewItem } from "~/features/links/types"
import {
  confirmSaveIntent,
  resolveSaveIntent,
} from "~/features/links/save-intent"

const createLink = (url: string, id?: string): LinkViewItem => ({
  url,
  id,
  timestamp: Date.now(),
  metadata: {
    schemaVersion: 3,
    source: {},
    extraction: { extractedLinks: [] },
    playback: { openedUrls: [] },
  },
})

describe("save intent", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns user-facing validation outcomes before persistence", async () => {
    const addLink = vi.fn()
    const enqueueLink = vi.fn()

    await expect(
      resolveSaveIntent({
        currentUrl: "",
        links: [],
        addLink,
        enqueueLink,
        shouldAutoSaveAllLinks: true,
      })
    ).resolves.toEqual({ kind: "error", message: "Enter a URL." })

    await expect(
      resolveSaveIntent({
        currentUrl: "not a url",
        links: [],
        addLink,
        enqueueLink,
        shouldAutoSaveAllLinks: true,
      })
    ).resolves.toEqual({ kind: "error", message: "Enter a valid URL." })
    expect(addLink).not.toHaveBeenCalled()
    expect(enqueueLink).not.toHaveBeenCalled()
  })

  it("detects duplicates after removing inline credentials", async () => {
    const addLink = vi.fn()
    const enqueueLink = vi.fn()

    await expect(
      resolveSaveIntent({
        currentUrl: "https://username:password@index.example.com/0:/Shows/",
        links: [createLink("https://index.example.com/0:/Shows/", "saved-id")],
        addLink,
        enqueueLink,
        shouldAutoSaveAllLinks: true,
      })
    ).resolves.toEqual({
      kind: "duplicate",
      linkId: "saved-id",
      message: "Link already exists.",
    })
    expect(enqueueLink).not.toHaveBeenCalled()
  })

  it("returns selection data without opening a dialog or saving", async () => {
    const metadata = { filename: "Shows" }
    const extractedLinks: ExtractedLink[] = [
      { id: "episode-one", label: "Episode One", url: "https://example.com/1" },
      { id: "episode-two", label: "Episode Two", url: "https://example.com/2" },
    ]
    vi.spyOn(extractionOrchestration, "getSourceMetadata").mockResolvedValue(
      metadata
    )
    vi.spyOn(extractionOrchestration, "prepareSource").mockResolvedValue({
      metadata,
      mergedMeta: metadata,
      presentation: { kind: "selectionDialog", links: extractedLinks },
    })
    const addLink = vi.fn()
    const enqueueLink = vi.fn()

    await expect(
      resolveSaveIntent({
        currentUrl: "https://example.com/shows",
        links: [],
        addLink,
        enqueueLink,
        shouldAutoSaveAllLinks: false,
      })
    ).resolves.toEqual({
      kind: "selection-required",
      selection: {
        originalUrl: "https://example.com/shows",
        links: extractedLinks,
        meta: metadata,
      },
      previewMeta: metadata,
    })
    expect(addLink).not.toHaveBeenCalled()
    expect(enqueueLink).not.toHaveBeenCalled()
  })

  it("returns an update outcome for an existing saved link", async () => {
    const selectedLinks: ExtractedLink[] = [
      { id: "episode-one", label: "Episode One", url: "https://example.com/1" },
    ]
    const addLink = vi.fn()

    await expect(
      confirmSaveIntent({
        selectedLinks,
        originalUrl: "https://example.com/shows",
        meta: {},
        existingItemId: "saved-id",
        addLink,
      })
    ).resolves.toEqual({
      kind: "updated",
      itemUrl: "https://example.com/shows",
      links: selectedLinks,
    })
    expect(addLink).not.toHaveBeenCalled()
  })
})

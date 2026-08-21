import { beforeEach, describe, expect, it, vi } from "vitest"
import { extractionOrchestration } from "~/lib/extraction/orchestration"
import { saveLink } from "~/features/links/use-link-actions/save-flow"
import type { SavedLinkInteractionReporter } from "~/features/links/saved-link-interaction"

const createReporter = (): SavedLinkInteractionReporter => ({
  publish: vi.fn(),
})

describe("Bhadoo save flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("uses inline credentials for extraction but strips them from the saved URL", async () => {
    const credentialedUrl =
      "https://source-user:source%40secret@index.example.com/0:/Movies/"
    const sanitizedUrl = "https://index.example.com/0:/Movies/"
    const meta = {
      filename: "Movies",
      pluginId: "bhadoo-google-drive-index",
      sourceName: "Bhadoo Google Drive Index",
      sourceCredentialKind: "http-basic" as const,
      pluginServerId: "lynvo-plugin-server",
    }
    vi.spyOn(extractionOrchestration, "getSourceMetadata").mockResolvedValue(
      meta
    )
    vi.spyOn(extractionOrchestration, "prepareSource").mockResolvedValue({
      metadata: meta,
      mergedMeta: meta,
      presentation: {
        kind: "directSave",
        link: {
          id: "movie",
          label: "Movie.mp4",
          url: "https://index.example.com/0:/Movies/Movie.mp4",
        },
      },
    })
    const addLink = vi.fn().mockResolvedValue("saved-id")
    const reporter = createReporter()

    const result = await saveLink({
      currentUrl: credentialedUrl,
      links: [],
      addLink,
      reporter,
      shouldAutoSaveAllLinks: false,
    })

    expect(extractionOrchestration.getSourceMetadata).toHaveBeenCalledWith(
      credentialedUrl,
      []
    )
    expect(extractionOrchestration.prepareSource).toHaveBeenCalledWith(
      expect.objectContaining({ targetUrl: credentialedUrl })
    )
    expect(addLink).toHaveBeenCalledWith(sanitizedUrl, meta, expect.any(Array))
    expect(result?.pluginDomainSuggestion).toEqual({
      domain: "index.example.com",
      pluginId: "bhadoo-google-drive-index",
      pluginName: "Bhadoo Google Drive Index",
      sanitizedUrl,
      username: "source-user",
      password: "source@secret",
      pluginServerId: "lynvo-plugin-server",
    })
  })

  it("saves every extracted link without opening selection when enabled", async () => {
    const sourceUrl = "https://index.example.com/0:/Shows/"
    const metadata = { filename: "Shows" }
    const extractedLinks = [
      {
        id: "episode-one",
        label: "Episode One",
        url: "https://index.example.com/0:/Shows/Episode-One.mkv",
      },
      {
        id: "episode-two",
        label: "Episode Two",
        url: "https://index.example.com/0:/Shows/Episode-Two.mkv",
      },
    ]
    vi.spyOn(extractionOrchestration, "getSourceMetadata").mockResolvedValue(
      metadata
    )
    vi.spyOn(extractionOrchestration, "prepareSource").mockResolvedValue({
      metadata,
      mergedMeta: metadata,
      presentation: { kind: "selectionDialog", links: extractedLinks },
    })
    const addLink = vi.fn().mockResolvedValue("saved-id")
    const reporter = createReporter()

    await saveLink({
      currentUrl: sourceUrl,
      links: [],
      addLink,
      reporter,
      shouldAutoSaveAllLinks: true,
    })

    expect(addLink).toHaveBeenCalledWith(sourceUrl, metadata, extractedLinks)
    expect(reporter.publish).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: "selection-required" })
    )
  })

  it("reports an error and does not reset view when addLink fails", async () => {
    const sourceUrl = "https://example.com/video.mp4"
    const metadata = { filename: "Video.mp4" }
    vi.spyOn(extractionOrchestration, "getSourceMetadata").mockResolvedValue(
      metadata
    )
    vi.spyOn(extractionOrchestration, "prepareSource").mockResolvedValue({
      metadata,
      mergedMeta: metadata,
      presentation: {
        kind: "directSave",
        link: {
          id: "video-1",
          label: "Video.mp4",
          url: sourceUrl,
        },
      },
    })
    const addLink = vi.fn().mockResolvedValue(undefined)
    const reporter = createReporter()

    await saveLink({
      currentUrl: sourceUrl,
      links: [],
      addLink,
      reporter,
      shouldAutoSaveAllLinks: false,
    })

    expect(reporter.publish).toHaveBeenCalledWith({
      kind: "error",
      message: "Unable to save the link. Try again.",
    })
    expect(reporter.publish).toHaveBeenCalledWith({ kind: "clear-preview" })
    expect(reporter.publish).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: "view-reset" })
    )
  })
})

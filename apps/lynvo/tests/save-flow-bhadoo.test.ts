import { beforeEach, describe, expect, it, vi } from "vitest"
import { extractionOrchestration } from "~/lib/extraction/orchestration"
import { saveLink } from "~/features/links/use-link-actions/save-flow"

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
    const enqueueLink = vi.fn()

    const result = await saveLink({
      currentUrl: credentialedUrl,
      links: [],
      addLink,
      enqueueLink,
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

  it("queues a source immediately when auto-save is enabled", async () => {
    const sourceUrl = "https://index.example.com/0:/Shows/"
    const addLink = vi.fn()
    const enqueueLink = vi.fn().mockResolvedValue("saved-id")

    const result = await saveLink({
      currentUrl: sourceUrl,
      links: [],
      addLink,
      enqueueLink,
      shouldAutoSaveAllLinks: true,
    })

    expect(enqueueLink).toHaveBeenCalledWith(sourceUrl)
    expect(addLink).not.toHaveBeenCalled()
    expect(result).toEqual({ kind: "queued", linkId: "saved-id" })
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
    const enqueueLink = vi.fn()

    const result = await saveLink({
      currentUrl: sourceUrl,
      links: [],
      addLink,
      enqueueLink,
      shouldAutoSaveAllLinks: false,
    })

    expect(result).toEqual({
      kind: "error",
      message: "Unable to save link. Try again.",
      previewMeta: metadata,
    })
  })
})

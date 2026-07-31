import { beforeEach, describe, expect, it, vi } from "vitest"
import { extractionOrchestration } from "~/lib/extraction/orchestration"
import { saveLink } from "~/features/links/use-link-actions/save-flow"
import type { SaveFlowEffects } from "~/features/links/use-link-actions/save-flow-effects"

const createEffects = (): SaveFlowEffects => ({
  clearError: vi.fn(),
  showError: vi.fn(),
  clearPreview: vi.fn(),
  showPreview: vi.fn(),
  openSelection: vi.fn(),
  closeSelection: vi.fn(),
  focusRecent: vi.fn(),
  resetAfterSave: vi.fn(),
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
      workerId: "official-extractor",
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
    const addRecent = vi.fn().mockResolvedValue("saved-id")
    const effects = createEffects()

    const result = await saveLink({
      currentUrl: credentialedUrl,
      recents: [],
      addRecent,
      effects,
    })

    expect(extractionOrchestration.getSourceMetadata).toHaveBeenCalledWith(
      credentialedUrl,
      []
    )
    expect(extractionOrchestration.prepareSource).toHaveBeenCalledWith(
      expect.objectContaining({ targetUrl: credentialedUrl })
    )
    expect(addRecent).toHaveBeenCalledWith(
      sanitizedUrl,
      meta,
      expect.any(Array)
    )
    expect(result?.pluginDomainSuggestion).toEqual({
      domain: "index.example.com",
      pluginId: "bhadoo-google-drive-index",
      pluginName: "Bhadoo Google Drive Index",
      sanitizedUrl,
      username: "source-user",
      password: "source@secret",
      workerId: "official-extractor",
    })
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"
import { createExtractionOrchestration } from "~/lib/extraction/orchestration"
import { decideSavePresentation } from "~/lib/extraction/presentation"
import type { ExtractedLink, LinkViewItem } from "~/features/links/types"

const savedWorkerItem = (): LinkViewItem => ({
  url: "https://example.com/source",
  timestamp: 1,
  metadata: {
    schemaVersion: 3,
    source: {
      pluginServerId: "pluginServer-1",
      pluginId: "example-drive-index",
      sourceName: "Plugin Server Source",
    },
    extraction: {
      extractedLinks: [
        {
          id: "folder-1",
          url: "https://pluginServer.example/folder/1",
          label: "Folder",
          mediaNodeKind: "resolvable",
          type: "folder",
        },
      ],
    },
    playback: { openedUrls: [] },
  },
  extractedLinks: [
    {
      id: "folder-1",
      url: "https://pluginServer.example/folder/1",
      label: "Folder",
      type: "folder",
    },
  ],
})

const createTransport = () => ({
  extract: vi.fn<ExtractionTransport["extract"]>(),
  getMetadata: vi.fn<ExtractionTransport["getMetadata"]>(),
})

describe("extraction presentation", () => {
  it("direct-saves one file or mirror container and selects folders", () => {
    const file: ExtractedLink = {
      url: "https://cdn.example/one.mp4",
      label: "One",
      mediaNodeKind: "playable",
    }
    expect(decideSavePresentation([file])).toEqual({
      kind: "directSave",
      link: file,
    })
    expect(decideSavePresentation([file, { ...file, url: "two" }]).kind).toBe(
      "selectionDialog"
    )
    expect(
      decideSavePresentation([
        { ...file, type: "folder", mediaNodeKind: "group" },
      ]).kind
    ).toBe("selectionDialog")
    expect(
      decideSavePresentation([
        {
          ...file,
          type: "folder",
          mediaNodeKind: "resolvable",
        },
      ]).kind
    ).toBe("directSave")
    expect(
      decideSavePresentation([
        {
          ...file,
          type: "folder",
          mediaNodeKind: "resolvable",
          resolutionKind: "folder",
        },
      ]).kind
    ).toBe("selectionDialog")
    expect(decideSavePresentation([]).kind).toBe("error")
  })
})

describe("extraction orchestration", () => {
  const transport = createTransport()
  const orchestration = createExtractionOrchestration(transport)

  beforeEach(() => {
    transport.extract.mockReset()
    transport.getMetadata.mockReset()
  })

  it("prepares save metadata and propagates the saved pluginServer identity", async () => {
    transport.getMetadata.mockResolvedValue({
      filename: "playable-item.mp4",
      sourceName: "Metadata Source",
    })
    transport.extract.mockResolvedValue({
      links: [
        {
          url: "https://cdn.example/playable-item.mp4",
          label: "Playable Item",
          mediaNodeKind: "playable",
        },
      ],
      meta: {
        pageTitle: "Playable Item Page",
        pluginServerId: "pluginServer-1",
      },
    })
    const metadata = await orchestration.getSourceMetadata(
      "https://example.com/source",
      [savedWorkerItem()]
    )
    const result = await orchestration.prepareSource({
      targetUrl: "https://example.com/source",
      links: [savedWorkerItem()],
      sourceMetadata: metadata,
    })

    expect(transport.extract).toHaveBeenCalledWith({
      url: "https://example.com/source",
      pluginServerId: "pluginServer-1",
      pluginId: "example-drive-index",
    })
    expect(metadata).toEqual(
      expect.objectContaining({ pluginServerId: "pluginServer-1" })
    )
    expect(result.mergedMeta).toEqual(
      expect.objectContaining({
        filename: "playable-item.mp4",
        pageTitle: "Playable Item Page",
        pluginServerId: "pluginServer-1",
      })
    )
  })

  it("routes refresh, mirror, and folder operations through the saved pluginServer", async () => {
    const item = savedWorkerItem()
    const resolved: ExtractedLink[] = [
      {
        url: "https://cdn.example/resolved.mp4",
        label: "Resolved",
        mediaNodeKind: "playable",
      },
    ]
    transport.extract.mockResolvedValue({ links: resolved })

    await orchestration.refreshSource(item)
    await orchestration.resolveMirror(
      item,
      "https://pluginServer.example/playable-item"
    )
    const expanded = await orchestration.expandFolder({
      item,
      linkId: "folder-1",
      linkUrl: "https://pluginServer.example/folder/1",
    })

    expect(transport.extract.mock.calls).toEqual([
      [
        {
          url: "https://example.com/source",
          pluginServerId: "pluginServer-1",
          pluginId: "example-drive-index",
        },
      ],
      [
        {
          url: "https://pluginServer.example/playable-item",
          pluginServerId: "pluginServer-1",
          pluginId: "example-drive-index",
          kind: "node",
        },
      ],
      [
        {
          url: "https://pluginServer.example/folder/1",
          pluginServerId: "pluginServer-1",
          pluginId: "example-drive-index",
          kind: "node",
        },
      ],
    ])
    expect(expanded[0].children).toEqual(resolved)
  })

  it("preserves partial extraction results", async () => {
    transport.getMetadata.mockResolvedValue({ filename: "source" })
    transport.extract.mockResolvedValue({
      links: [
        {
          url: "https://cdn.example/available.mp4",
          label: "Available",
          mediaNodeKind: "playable",
        },
      ],
    })

    const result = await orchestration.prepareSource({
      targetUrl: "https://example.com/new",
      links: [],
    })

    expect(result.presentation.kind).toBe("directSave")
  })
})

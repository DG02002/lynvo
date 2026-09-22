import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { LinkViewItem } from "~/features/links/types"
import { useSaveActions } from "~/features/links/use-link-actions/save-actions"
import { client } from "~/lib/api/client"

describe("useSaveActions", () => {
  it("dismisses a Plugin Domain suggestion when adding it fails", async () => {
    const listDomains = vi
      .spyOn(client.pluginDomains, "list")
      .mockResolvedValue([])
    const createDomain = vi
      .spyOn(client.pluginDomains, "create")
      .mockRejectedValue(new Error("unavailable"))
    const createActions = (links: LinkViewItem[]) =>
      useSaveActions({
        url: "https://index.example.com/0:/Movies/",
        links,
        addLink: vi.fn(async () => "link-1"),
        enqueueLink: vi.fn(async () => "link-1"),
        updateLinks: vi.fn(),
        openSelectionDialog: vi.fn(),
        setExtractionPreview: vi.fn(),
        closeSelectionDialog: vi.fn(),
        selectionDialogState: {
          open: false,
          links: [],
          meta: {},
          originalUrl: "",
        },
        setError: vi.fn(),
        setCurrentUrl: vi.fn(),
        setHighlightedId: vi.fn(),
      })
    const { result, rerender } = renderHook(
      ({ links }: { links: LinkViewItem[] }) => createActions(links),
      { initialProps: { links: [] } }
    )

    await act(async () => {
      await result.current.handleSave()
    })
    rerender({
      links: [
        {
          id: "link-1",
          url: "https://index.example.com/0:/Movies/",
          timestamp: 1,
          metadata: {
            schemaVersion: 3,
            source: {
              pluginId: "example-drive-index",
              pluginName: "Example Drive Index",
              pluginServerId: "lynvo:dev.lynvo.plugin-server",
              sourceCredentialKind: "domain-password",
            },
            extraction: { extractedLinks: [] },
            playback: { openedUrls: [] },
          },
          extractionStatus: { state: "complete" },
        },
      ],
    })
    await waitFor(() =>
      expect(result.current.pluginDomainDialog.suggestion).not.toBeNull()
    )

    await act(async () => {
      await result.current.pluginDomainDialog.add()
    })

    expect(createDomain).toHaveBeenCalledOnce()
    expect(result.current.pluginDomainDialog.suggestion).toBeNull()

    listDomains.mockRestore()
    createDomain.mockRestore()
  })
})

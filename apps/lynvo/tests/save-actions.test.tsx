import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { toast } from "~/components/ui/toast"
import {
  dismissPluginDomainSuggestion,
  shouldOfferPluginDomainSuggestion,
} from "~/features/links/saved-link-interaction"
import type { LinkViewItem } from "~/features/links/types"
import { useSaveActions } from "~/features/links/use-link-actions/save-actions"
import { client } from "~/lib/api/client"

describe("useSaveActions", () => {
  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

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

  it("clears a dismissed Plugin Domain after adding it successfully", async () => {
    const listDomains = vi
      .spyOn(client.pluginDomains, "list")
      .mockResolvedValue([])
    const createDomain = vi
      .spyOn(client.pluginDomains, "create")
      .mockResolvedValue({ success: true, dataVersion: 1 })
    const createActions = (links: LinkViewItem[]) =>
      useSaveActions({
        url: "https://index.example.com/0:/Movies/",
        links,
        addLink: vi.fn(async () => "link-2"),
        enqueueLink: vi.fn(async () => "link-2"),
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
    const completedLink: LinkViewItem = {
      id: "link-2",
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
    }
    rerender({ links: [completedLink] })
    await waitFor(() =>
      expect(result.current.pluginDomainDialog.suggestion).not.toBeNull()
    )

    const { suggestion } = result.current.pluginDomainDialog
    if (!suggestion) {
      throw new Error("expected a Plugin Domain suggestion")
    }
    dismissPluginDomainSuggestion(suggestion)
    await act(async () => {
      await result.current.pluginDomainDialog.add()
    })

    expect(createDomain).toHaveBeenCalledOnce()
    await expect(
      shouldOfferPluginDomainSuggestion(suggestion, async () => [])
    ).resolves.toEqual(suggestion)

    listDomains.mockRestore()
    createDomain.mockRestore()
  })

  it("does not celebrate at enqueue time and confirms a failed queued save with feedback", async () => {
    const toastAdd = vi.spyOn(toast, "add")
    const vibrate = vi.fn()
    Object.defineProperty(navigator, "vibrate", {
      value: vibrate,
      configurable: true,
    })
    const setHighlightedId = vi.fn()
    const createActions = (links: LinkViewItem[]) =>
      useSaveActions({
        url: "https://index.example.com/0:/Movies/",
        links,
        addLink: vi.fn(async () => "link-fail"),
        enqueueLink: vi.fn(async () => "link-fail"),
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
        setHighlightedId,
      })
    const { result, rerender } = renderHook(
      ({ links }: { links: LinkViewItem[] }) => createActions(links),
      { initialProps: { links: [] } }
    )

    await act(async () => {
      await result.current.handleSave()
    })

    // Enqueueing is not the outcome: no success buzz until the queue
    // settles, only the tap acknowledgment.
    expect(vibrate).toHaveBeenCalledTimes(1)
    expect(vibrate).toHaveBeenCalledWith(4)

    rerender({
      links: [
        {
          id: "link-fail",
          url: "https://index.example.com/0:/Movies/",
          timestamp: 1,
          metadata: {
            schemaVersion: 3,
            source: {},
            extraction: { extractedLinks: [] },
            playback: { openedUrls: [] },
          },
          extractionStatus: { state: "failed", error: "Source unavailable" },
        },
      ],
    })
    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Couldn’t load the saved link",
          description: "Source unavailable",
        })
      )
    )

    expect(vibrate).toHaveBeenLastCalledWith([70, 60, 70])
    // The highlight is refreshed at the completion moment, not only at
    // enqueue time.
    expect(setHighlightedId).toHaveBeenLastCalledWith("link-fail")
  })
})

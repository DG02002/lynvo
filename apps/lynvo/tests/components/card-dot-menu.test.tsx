import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  DraftCardDotMenu,
  RecentLinkCardDotMenu,
} from "~/components/links/CardDotMenu"
import { readDraft, writeDraft } from "~/components/links/DraftManager"
import type { LinkCardActions } from "~/features/links/link-card-actions"
import type { ExtractedLink } from "~/features/links/types"

const createActions = (): LinkCardActions => ({
  play: vi.fn(),
  remove: vi.fn(),
  showLinks: vi.fn(),
  markWatched: vi.fn(),
  expandFolder: vi.fn(),
  softRefresh: vi.fn(),
  hardRefresh: vi.fn(),
  expandMirror: vi.fn(),
  setAsCurrent: vi.fn(),
})

describe("CardDotMenu", () => {
  beforeEach(() => {
    const storedValues = new Map<string, string>()
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storedValues.get(key) ?? null,
        setItem: (key: string, value: string) => storedValues.set(key, value),
      },
    })
  })

  it("removes a draft from draft storage", async () => {
    const draftUrl = "https://example.com/draft"
    const actions = createActions()
    writeDraft(draftUrl, [], {})

    render(
      <DraftCardDotMenu
        item={{
          url: draftUrl,
          timestamp: Date.now(),
          extractedLinks: [],
          isDraft: true,
        }}
        actions={actions}
        showRemove
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }))
    fireEvent.click(await screen.findByText("Remove Draft"))
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }))

    expect(readDraft(draftUrl)).toBeNull()
    expect(actions.remove).not.toHaveBeenCalled()
  })

  it("replaces the menu button with a spinner while re-selecting links", async () => {
    const actions = createActions()
    const item = {
      url: "https://example.com/folder",
      timestamp: Date.now(),
      extractedLinks: [],
    }
    const { rerender } = render(
      <RecentLinkCardDotMenu item={item} actions={actions} showRemove />
    )

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }))
    fireEvent.click(await screen.findByText("Re-Select Links"))
    expect(actions.hardRefresh).toHaveBeenCalledWith(item.url)

    rerender(
      <RecentLinkCardDotMenu
        item={item}
        actions={actions}
        showRemove
        isRefreshing
      />
    )

    expect(
      screen.getByRole("button", { name: "Re-selecting links" })
    ).toBeDisabled()
    expect(screen.getByRole("status", { name: "Loading" })).toBeVisible()
  })

  it("does not offer refresh or re-selection for a direct saved link", async () => {
    const directLink: ExtractedLink = {
      url: "https://cdn.example.com/video.mp4",
      label: "video.mp4",
      type: "file",
    }

    render(
      <RecentLinkCardDotMenu
        item={{
          url: "https://cdn.example.com/video.mp4",
          timestamp: Date.now(),
          extractedLinks: [directLink],
        }}
        actions={createActions()}
        playableLink={directLink}
        showRemove
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }))

    await waitFor(() => {
      expect(screen.getByText("Open in")).toBeInTheDocument()
    })
    expect(screen.queryByText("Refresh")).not.toBeInTheDocument()
    expect(screen.queryByText("Re-Select Links")).not.toBeInTheDocument()
  })
})

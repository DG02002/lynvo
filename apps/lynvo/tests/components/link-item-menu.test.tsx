import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  DraftLinkItemMenu,
  LinkItemMenu,
} from "~/components/links/LinkItemMenu"
import { readDraft, writeDraft } from "~/features/links/drafts"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import type { ExtractedLink } from "~/features/links/types"

const TEST_USER_ID = "test-user"

const createActions = (): LinkItemActions => ({
  play: vi.fn().mockResolvedValue({ accepted: true }),
  remove: vi.fn(),
  showLinks: vi.fn(),
  markOpened: vi.fn(),
  expandFolder: vi.fn(),
  softRefresh: vi.fn(),
  hardRefresh: vi.fn(),
  expandMirror: vi.fn(),
})

describe("LinkItemMenu", () => {
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
    writeDraft(TEST_USER_ID, draftUrl, [], {})

    render(
      <DraftLinkItemMenu
        item={{
          kind: "draft",
          userId: TEST_USER_ID,
          url: draftUrl,
          timestamp: Date.now(),
          title: draftUrl,
          extractedLinks: [],
          meta: {},
          expiresAt: Date.now() + 60_000,
        }}
        actions={actions}
        showRemove
      />
    )

    fireEvent.click(
      screen.getByRole("button", { name: `Open menu for ${draftUrl}` })
    )
    fireEvent.click(await screen.findByText("Remove draft"))
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }))

    expect(readDraft(TEST_USER_ID, draftUrl)).toBeNull()
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
      <LinkItemMenu item={item} actions={actions} showRemove />
    )

    fireEvent.click(
      screen.getByRole("button", { name: `Open menu for ${item.url}` })
    )
    fireEvent.click(await screen.findByText("Reload link choices"))
    expect(actions.hardRefresh).toHaveBeenCalledWith(item.url)

    rerender(
      <LinkItemMenu item={item} actions={actions} showRemove isRefreshing />
    )

    expect(
      screen.getByRole("button", { name: /Reloading link choices for/ })
    ).toBeDisabled()
  })

  it("does not offer refresh or re-selection for a Direct Media saved link", async () => {
    const directLink: ExtractedLink = {
      url: "https://cdn.example.com/video.mp4",
      label: "video.mp4",
      type: "file",
    }

    render(
      <LinkItemMenu
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

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open menu for https://cdn.example.com/video.mp4",
      })
    )

    await waitFor(() => {
      expect(screen.getByText("Open in")).toBeInTheDocument()
    })
    expect(screen.queryByText("Refresh")).not.toBeInTheDocument()
    expect(screen.queryByText("Reload link choices")).not.toBeInTheDocument()
  })

  it("offers only management actions for an expired Direct Media link", async () => {
    const directLink: ExtractedLink = {
      url: "https://cdn.example.com/expired.mp4",
      label: "expired.mp4",
      type: "file",
    }

    render(
      <LinkItemMenu
        item={{
          url: directLink.url,
          timestamp: Date.now(),
          extractedLinks: [directLink],
        }}
        actions={createActions()}
        playableLink={directLink}
        isPlayableLinkExpired
        showRemove
      />
    )

    fireEvent.click(
      screen.getByRole("button", {
        name: `Open menu for ${directLink.url}`,
      })
    )

    await waitFor(() => {
      expect(screen.getByText("Copy Source link")).toBeInTheDocument()
    })
    expect(screen.getByText("Remove saved link")).toBeInTheDocument()
    expect(screen.queryByText("Open in")).not.toBeInTheDocument()
    expect(screen.queryByText("Reload link choices")).not.toBeInTheDocument()
  })
})

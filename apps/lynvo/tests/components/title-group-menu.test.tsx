import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TitleGroupMenu } from "~/features/links/components/title-group-menu"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import type { LinkListItem } from "~/features/links/types"
import { setShouldAutoSaveAllLinks } from "~/features/site/settings/auto-save-links-preference"
import { createMemoryStorage } from "../memory-storage"

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const createSavedLink = (id: string): LinkListItem => ({
  kind: "saved",
  id,
  url: `https://source.example/${id}`,
  timestamp: 1,
  metadata: {
    schemaVersion: 3,
    source: {},
    extraction: {
      extractedLinks: [
        {
          nodeKey: `${id}:node`,
          url: `https://media.example/${id}.mkv`,
          label: `${id}.mkv`,
          type: "file",
          mediaNodeKind: "playable",
        },
      ],
    },
    playback: { openedUrls: [] },
  },
})

const createActions = (
  overrides: Partial<LinkItemActions> = {}
): LinkItemActions => ({
  play: vi.fn().mockResolvedValue({ accepted: true }),
  remove: vi.fn(),
  showLinks: vi.fn(),
  markOpened: vi.fn(),
  expandFolder: vi.fn().mockResolvedValue(null),
  softRefresh: vi.fn(),
  hardRefresh: vi.fn(),
  expandMirror: vi.fn().mockResolvedValue(null),
  ...overrides,
})

const createGroup = (): TitleGroupProjection => ({
  id: "group-id",
  identityKey: "movie:example movie:2026",
  mediaKind: "movie",
  displayTitle: "Example Movie",
  year: 2026,
  metadataState: "unavailable",
  lastAddedAt: 1,
  sourceCount: 2,
  entries: [],
})

const openMenu = async () => {
  fireEvent.click(screen.getByRole("button", { name: /Open menu for/i }))
  await waitFor(() =>
    expect(screen.getByRole("menu", { name: /Open menu for/i })).toBeVisible()
  )
  return screen.getByRole("menu", { name: /Open menu for/i })
}

describe("TitleGroupMenu", () => {
  it("keeps the per-link menu when one saved link backs the group", async () => {
    const menu = render(
      <TitleGroupMenu
        group={createGroup()}
        savedLinks={[createSavedLink("single-link")]}
        actions={createActions()}
      />
    )

    const dropdownMenu = await openMenu()
    expect(dropdownMenu).toHaveTextContent("Copy Source link")
    expect(dropdownMenu).toHaveTextContent("Remove saved link")
    expect(dropdownMenu).not.toHaveTextContent("Remove saved links")
    menu.unmount()
  })

  it("uses Refresh for an automatically saved link", async () => {
    const softRefresh = vi.fn()
    const hardRefresh = vi.fn()
    setShouldAutoSaveAllLinks(true)
    const menu = render(
      <TitleGroupMenu
        group={createGroup()}
        savedLinks={[createSavedLink("auto-saved-link")]}
        actions={createActions({ softRefresh, hardRefresh })}
      />
    )

    const dropdownMenu = await openMenu()
    expect(dropdownMenu).toHaveTextContent("Refresh")
    expect(dropdownMenu).not.toHaveTextContent("Reload link choices")

    fireEvent.click(screen.getByRole("menuitem", { name: "Refresh" }))
    expect(softRefresh).toHaveBeenCalledWith(
      "https://source.example/auto-saved-link"
    )
    expect(hardRefresh).not.toHaveBeenCalled()
    menu.unmount()
  })

  it("offers a group-scoped remove when multiple saved links back the group", async () => {
    const remove = vi.fn()
    const menu = render(
      <TitleGroupMenu
        group={createGroup()}
        savedLinks={[
          createSavedLink("quality-720p"),
          createSavedLink("quality-1080p"),
        ]}
        actions={createActions({ remove })}
        onRemoved={() => {}}
      />
    )

    const dropdownMenu = await openMenu()
    expect(dropdownMenu).not.toHaveTextContent("Copy Source link")
    expect(dropdownMenu).toHaveTextContent("Remove saved links")

    fireEvent.click(screen.getByText("Remove saved links"))
    expect(
      await screen.findByRole("alertdialog", { name: "Remove 2 saved links?" })
    ).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Remove links" }))
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(2))
    expect(remove).toHaveBeenCalledWith(
      "https://source.example/quality-720p",
      "quality-720p"
    )
    expect(remove).toHaveBeenCalledWith(
      "https://source.example/quality-1080p",
      "quality-1080p"
    )
    menu.unmount()
  })
})

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SaveListBrowser } from "~/components/save-list/save-list-browser"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import type { ExtractedLink, LinkViewItem } from "~/features/links/types"
import { withOpenedUrl } from "~/features/links/link-playback-metadata"
import { TEST_PLAYABLE_EXPIRY_AT_MS } from "~/features/links/testing/constants"

const createActions = (
  overrides: Partial<LinkItemActions> = {}
): LinkItemActions => ({
  play: vi.fn().mockResolvedValue({ accepted: true }),
  remove: vi.fn(),
  showLinks: vi.fn(),
  markOpened: vi.fn(),
  expandFolder: vi.fn(),
  softRefresh: vi.fn(),
  hardRefresh: vi.fn(),
  expandMirror: vi.fn().mockResolvedValue(null),
  ...overrides,
})

describe("SaveListBrowser", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    })
  })

  it("restores the nested folder in the same tab after refresh", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    })
    const item: LinkViewItem = {
      id: "saved-collection",
      url: "https://media.example/collection",
      timestamp: 1,
      title: "Saved Collection",
      metadata: {
        schemaVersion: 3,
        source: {},
        extraction: {
          extractedLinks: [
            {
              id: "season-one",
              url: "https://media.example/collection/season-one",
              label: "Season One",
              type: "folder",
              children: [
                {
                  id: "episode-one",
                  url: "https://media.example/collection/season-one/episode-one.mkv",
                  label: "Episode One",
                  type: "file",
                },
              ],
            },
          ],
        },
        playback: { openedUrls: [], openedIds: [] },
      },
    }
    const onSelectedItemUrlChange = vi.fn()
    const renderSavedFolder = () =>
      render(
        <SaveListBrowser
          items={[{ ...item, kind: "saved" }]}
          selectedItemUrl={item.url}
          onSelectedItemUrlChange={onSelectedItemUrlChange}
          actions={createActions()}
          extractingItems={new Set()}
          highlightedId={null}
          isHydrating={false}
        />
      )

    const firstRender = renderSavedFolder()
    const headerMenu = screen.getByRole("button", {
      name: "Open menu for Saved Collection",
    })
    expect(headerMenu).toHaveClass(
      "size-full!",
      "rounded-none!",
      "[&_svg]:size-7!",
      "text-foreground!"
    )
    expect(headerMenu.parentElement).toHaveClass("w-16", "text-foreground")
    expect(headerMenu.parentElement).not.toHaveClass("border-s")
    const backButton = screen.getByRole("button", { name: "Back" })
    expect(backButton).toHaveClass("text-lg", "text-foreground")
    expect(backButton.querySelector("svg")).toHaveClass(
      "size-6",
      "text-foreground"
    )
    const seasonFolderButton = screen
      .getAllByRole("button", { name: /Season One/ })
      .at(-1)
    expect(seasonFolderButton?.querySelectorAll("svg")).toHaveLength(1)
    fireEvent.click(seasonFolderButton!)
    expect(await screen.findByText("Episode One")).toBeVisible()

    firstRender.unmount()
    renderSavedFolder()

    expect(screen.getByText("Episode One")).toBeVisible()
    expect(screen.getByRole("button", { name: /Season One/ })).toHaveAttribute(
      "aria-current",
      "page"
    )

    const contentList = document.querySelector<HTMLElement>(
      '[data-layout-guide-target="list-content"]'
    )
    expect(contentList).toBeInTheDocument()
    expect(contentList).toHaveClass("overflow-x-hidden")
    fireEvent.wheel(contentList!, { deltaX: -48, deltaY: 0 })
    expect(screen.queryByText("Episode One")).not.toBeInTheDocument()
    fireEvent.wheel(contentList!, { deltaX: 48, deltaY: 0 })
    expect(screen.getByText("Episode One")).toBeVisible()
    fireEvent.wheel(contentList!, { deltaX: -48, deltaY: 0 })
    expect(screen.queryByText("Episode One")).not.toBeInTheDocument()
    fireEvent.wheel(contentList!, { deltaX: 0, deltaY: 1 })
    fireEvent.wheel(contentList!, { deltaX: -48, deltaY: 0 })
    expect(onSelectedItemUrlChange).toHaveBeenCalledWith(null)
  })

  it("renders protocol group folders without url targets and marks them opened by id", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    })
    const markOpened = vi.fn()
    const item: LinkViewItem = {
      id: "plugin-series-item",
      url: "https://source.example/plugin-series",
      timestamp: 1,
      title: "Plugin Series",
      metadata: {
        schemaVersion: 3,
        source: {},
        extraction: {
          extractedLinks: [
            {
              nodeKey: "0:group:folder-S01",
              id: "folder-S01",
              label: "Season 1",
              type: "folder",
              mediaNodeKind: "group",
              selectable: false,
              children: [
                {
                  nodeKey: "0.0:resolvable:episode-one",
                  id: "episode-one",
                  nodeUrl: "https://files.example/drive/episode-one",
                  label: "Episode One",
                  type: "folder",
                  mediaNodeKind: "resolvable",
                  resolutionKind: "mirrors",
                },
              ],
            },
            {
              nodeKey: "1:group:identifier-less",
              label: "Identifier-less Group",
              type: "folder",
              mediaNodeKind: "group",
              selectable: false,
              children: [],
            },
          ],
        },
        playback: { openedUrls: [], openedIds: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={item.url}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions({ markOpened })}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    expect(
      screen.getAllByRole("button", { name: /Season 1/ }).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByRole("button", { name: /Identifier-less Group/ }).length
    ).toBeGreaterThan(0)

    const contentSeasonButton = screen
      .getAllByRole("button", { name: /Season 1/ })
      .at(-1)!
    fireEvent.click(contentSeasonButton)

    expect(await screen.findByText("Episode One")).toBeVisible()
    await waitFor(() =>
      expect(markOpened).toHaveBeenCalledWith(item.url, "folder-S01")
    )
  })

  it("registers navigation wheel events as non-passive", () => {
    const item: LinkViewItem = {
      id: "wheel-listener-item",
      url: "https://media.example/wheel-listener",
      timestamp: 1,
      title: "Wheel Listener Item",
      metadata: {
        schemaVersion: 3,
        source: {},
        extraction: {
          extractedLinks: [
            {
              id: "wheel-listener-file",
              url: "https://media.example/wheel-listener/file.mp4",
              label: "File.mp4",
              type: "file",
            },
          ],
        },
        playback: { openedUrls: [], openedIds: [] },
      },
    }
    const addEventListenerSpy = vi.spyOn(
      HTMLElement.prototype,
      "addEventListener"
    )

    try {
      render(
        <SaveListBrowser
          items={[{ ...item, kind: "saved" }]}
          selectedItemUrl={item.url}
          onSelectedItemUrlChange={vi.fn()}
          actions={createActions()}
          extractingItems={new Set()}
          highlightedId={null}
          isHydrating={false}
        />
      )

      expect(addEventListenerSpy.mock.calls).toContainEqual([
        "wheel",
        expect.any(Function),
        { passive: false },
      ])
    } finally {
      addEventListenerSpy.mockRestore()
    }
  })

  it("lazily extracts an unresolved folder when it is opened", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    })
    const resolvedLinks: ExtractedLink[] = [
      {
        id: "folder-alpha",
        url: "https://index.example.com/0:/Collections/Folder%20Alpha/",
        label: "Folder Alpha",
        type: "folder",
        childrenResolved: true,
        children: [
          {
            id: "playable-item-1",
            url: "https://index.example.com/0:/Collections/Folder%20Alpha/playable-item.mkv",
            label: "playable-item.mkv",
            type: "file",
          },
        ],
      },
    ]
    const expandFolder = vi.fn().mockResolvedValue(resolvedLinks)
    const item: LinkViewItem = {
      url: "https://index.example.com/0:/Collections/",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Source Alpha" },
        extraction: {
          extractedLinks: [
            {
              id: "folder-alpha",
              url: "https://index.example.com/0:/Collections/Folder%20Alpha/",
              label: "Folder Alpha",
              type: "folder",
              mediaNodeKind: "resolvable",
              resolutionKind: "folder",
            },
          ],
        },
        playback: { openedUrls: [], openedIds: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={item.url}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions({ expandFolder })}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    const folderButtons = screen.getAllByRole("button", {
      name: /Folder Alpha/,
    })
    expect(folderButtons).toHaveLength(2)
    expect(
      folderButtons.every(
        (button) => button.dataset.folderState === "lazy-closed"
      )
    ).toBe(true)
    fireEvent.click(folderButtons.at(-1)!)

    await waitFor(() =>
      expect(expandFolder).toHaveBeenCalledWith(
        item.url,
        "folder-alpha",
        "https://index.example.com/0:/Collections/Folder%20Alpha/"
      )
    )
    expect(await screen.findByText("playable-item.mkv")).toBeVisible()
    expect(
      screen.getByRole("button", { name: /Folder Alpha/ })
    ).toHaveAttribute("data-folder-state", "open")
  })

  it("shows a single resolvable container directly on the save page", async () => {
    const onSelectedItemUrlChange = vi.fn()
    const markOpened = vi.fn()
    const expandMirror = vi.fn().mockResolvedValue([
      {
        url: "https://files.example/route-alpha",
        label: "Play from Source Route Alpha",
        type: "file",
        size: "1.2 GB",
      },
    ])
    const item: LinkViewItem = {
      id: "plugin-source-beta-item",
      url: "https://plugin-source-beta.cx/drive/example",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Source Beta" },
        extraction: {
          extractedLinks: [
            {
              id: "plugin-source-beta-container",
              url: "https://plugin-source-beta.cx/drive/example",
              label: "Playable Item Alpha.mkv",
              type: "folder",
              mediaNodeKind: "resolvable",
              size: "8.2 GB",
            },
          ],
        },
        playback: { openedUrls: [], openedIds: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={null}
        onSelectedItemUrlChange={onSelectedItemUrlChange}
        actions={createActions({ expandMirror, markOpened })}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    fireEvent.click(
      screen.getByText("Playable Item Alpha.mkv").closest("button")!
    )

    expect(markOpened).not.toHaveBeenCalled()
    expect(
      await screen.findByText("Play from Source Route Alpha")
    ).toBeVisible()
    const sourceName = screen.getByText("Source Beta")
    expect(sourceName).toBeVisible()
    expect(sourceName.parentElement).toHaveTextContent("Source Beta·8.2 GB")
    expect(screen.getByText("1.2 GB")).toBeVisible()
    expect(onSelectedItemUrlChange).not.toHaveBeenCalled()
    expect(expandMirror).toHaveBeenCalledWith(item.url, item.url, false)

    fireEvent.click(
      screen.getByText("Play from Source Route Alpha").closest("button")!
    )
    await waitFor(() =>
      expect(markOpened).toHaveBeenCalledWith(item.url, item.url)
    )
  })

  it("resolves a Resolver Beta playable-item inline with loading and opened feedback", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    })
    let finishResolution: (() => void) | undefined
    let resolutionCount = 0
    const markOpened = vi.fn()
    const item: LinkViewItem = {
      id: "resolver-beta-item",
      url: "https://source-alpha.example/collection",
      timestamp: Date.now(),
      title: "Source Alpha collection",
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Source Alpha" },
        extraction: {
          extractedLinks: [
            {
              id: "playable-item-one",
              url: "https://resolver-beta.example/playable-item-one",
              label: "Playable Item One",
              type: "folder",
              mediaNodeKind: "resolvable",
            },
          ],
        },
        playback: { openedUrls: [], openedIds: [] },
      },
    }

    const Harness = () => {
      const [extractingItems, setExtractingItems] = useState(new Set<string>())
      const [currentItem, setCurrentItem] = useState({
        ...item,
        kind: "saved" as const,
      })
      const actions = createActions({
        markOpened: (itemUrl, linkUrl) => {
          markOpened(itemUrl, linkUrl)
          setCurrentItem((previousItem) => ({
            ...previousItem,
            metadata: withOpenedUrl(
              previousItem.metadata ?? previousItem.meta,
              linkUrl
            ),
          }))
        },
        expandMirror: async (_, lazyItemUrl) => {
          resolutionCount += 1
          setExtractingItems((currentItems) =>
            new Set(currentItems).add(lazyItemUrl)
          )
          await new Promise<void>((resolve) => {
            finishResolution = resolve
          })
          setExtractingItems(new Set())
          return [
            {
              url: `${lazyItemUrl}/route-alpha`,
              label: "Play from Source Route Alpha",
              type: "file",
              size: "1.2 GB",
            },
            {
              url: `${lazyItemUrl}/route-beta`,
              label: "Play from Source Route Beta Server",
              type: "file",
              size: "1.4 GB",
            },
            {
              url: `${lazyItemUrl}/route-gamma`,
              label: "Play from CF Server (404)",
              type: "file",
              status: "down",
            },
          ]
        },
      })

      return (
        <SaveListBrowser
          items={[currentItem]}
          selectedItemUrl={item.url}
          onSelectedItemUrlChange={vi.fn()}
          actions={actions}
          extractingItems={extractingItems}
          highlightedId={null}
          isHydrating={false}
        />
      )
    }

    render(<Harness />)
    const playableItemButton = screen
      .getByText("Playable Item One")
      .closest("button")!
    fireEvent.click(playableItemButton)

    expect(
      await screen.findByRole("status", {
        name: "Loading playable links for Playable Item One…",
      })
    ).toBeVisible()
    expect(playableItemButton).toHaveAttribute(
      "data-resolution-state",
      "resolving"
    )
    expect(markOpened).not.toHaveBeenCalled()

    finishResolution?.()

    await waitFor(() => {
      expect(
        screen.getByText("Play from Source Route Alpha")
      ).toBeInTheDocument()
      expect(
        screen.getByText("Play from Source Route Beta Server")
      ).toBeInTheDocument()
    })
    expect(screen.queryByText("Source Route Alpha")).not.toBeInTheDocument()
    expect(screen.queryByText("Source Route Beta")).not.toBeInTheDocument()
    expect(
      screen.queryByText("Play from CF Server (404)")
    ).not.toBeInTheDocument()
    expect(markOpened).not.toHaveBeenCalled()
    expect(playableItemButton).not.toHaveClass("bg-sky-500/15")
    expect(playableItemButton).toHaveClass("bg-transparent")
    expect(playableItemButton.parentElement).toHaveClass("bg-muted/60")
    expect(playableItemButton).toHaveAttribute(
      "data-resolution-state",
      "expanded"
    )
    expect(
      screen.getAllByRole("button", {
        name: /Open menu for Play from Source Route/,
      })
    ).toHaveLength(2)
    expect(
      screen
        .getAllByRole("button", {
          name: /Open menu for Play from Source Route/,
        })
        .every((menuButton) =>
          menuButton.classList.contains("text-foreground!")
        )
    ).toBe(true)
    expect(
      screen.getByRole("button", { name: "Open menu for Playable Item One" })
    ).toBeInTheDocument()
    expect(screen.getByText("1.2 GB")).toBeVisible()
    expect(playableItemButton.querySelectorAll("svg")).toHaveLength(1)
    expect(screen.getByText("1.4 GB")).toBeVisible()
    const mirrorGroup = screen
      .getByText("Play from Source Route Alpha")
      .closest('[data-layout-guide-target="list-row"]')
      ?.parentElement?.parentElement
    expect(mirrorGroup).toHaveClass("bg-muted/60", "ps-12", "md:ps-14")
    const connectors = mirrorGroup?.querySelectorAll(
      "[data-container-connector]"
    )
    expect(connectors).toHaveLength(3)
    expect(connectors?.[0]).toHaveClass("w-0.5", "bg-sky-500")
    expect(connectors?.[1]).toHaveClass(
      "-start-3",
      "h-0.5",
      "w-3",
      "bg-sky-500"
    )
    expect(
      screen
        .getAllByRole("button", {
          name: /Open menu for Play from Source Route/,
        })
        .every((menuButton) =>
          menuButton
            .closest("[data-container-children]")
            ?.classList.contains("bg-muted/60")
        )
    ).toBe(true)

    fireEvent.click(
      screen.getByText("Play from Source Route Alpha").closest("button")!
    )
    await waitFor(() =>
      expect(markOpened).toHaveBeenCalledWith(
        item.url,
        "https://resolver-beta.example/playable-item-one"
      )
    )
    expect(
      screen.getByRole("button", {
        name: "Open menu for Playable Item One",
      }).parentElement
    ).toHaveClass("bg-sky-500/15")
    expect(playableItemButton).toHaveClass("bg-sky-500/15")

    fireEvent.click(playableItemButton)
    await waitFor(() => {
      expect(
        screen.queryByText("Play from Source Route Alpha")
      ).not.toBeInTheDocument()
    })
    expect(playableItemButton).toHaveAttribute(
      "data-resolution-state",
      "collapsed"
    )
    fireEvent.click(playableItemButton)
    expect(
      await screen.findByText("Play from Source Route Alpha")
    ).toBeVisible()
    expect(resolutionCount).toBe(1)
  })

  it("shows a red failure state when a resolvable item returns no links", async () => {
    const markOpened = vi.fn()
    const item: LinkViewItem = {
      url: "https://source-alpha.example/failure",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Source Alpha" },
        extraction: {
          extractedLinks: [
            {
              id: "failed-playable-item",
              url: "https://resolver-beta.example/resolution-failure",
              label: "Playable Item Resolution Failure",
              type: "folder",
              mediaNodeKind: "resolvable",
            },
          ],
        },
        playback: { openedUrls: [], openedIds: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={item.url}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions({
          markOpened,
          expandMirror: vi.fn().mockResolvedValue(null),
        })}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    const failedPlayableItemButton = screen
      .getByText("Playable Item Resolution Failure")
      .closest("button")!
    fireEvent.click(failedPlayableItemButton)

    await waitFor(() => {
      expect(failedPlayableItemButton).toHaveAttribute(
        "data-resolution-state",
        "failed"
      )
    })
    expect(failedPlayableItemButton).toHaveClass("bg-destructive/15")
    expect(markOpened).not.toHaveBeenCalled()
  })

  it("shows the size of a single playable Google Drive item", () => {
    const directLink: ExtractedLink = {
      id: "google-drive-file",
      url: "https://drive.usercontent.google.com/download?id=google-drive-file",
      label: "Dolby ATMOS Helicopter.m2ts",
      type: "file",
      mediaNodeKind: "playable",
      size: "193.65 MB",
    }
    const item: LinkViewItem = {
      url: "https://drive.google.com/file/d/google-drive-file/view",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Google Drive" },
        extraction: { extractedLinks: [directLink] },
        playback: { openedUrls: [], openedIds: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={null}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions()}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    const sourceName = screen.getByText("Google Drive")
    const fileSize = screen.getByText("193.65 MB")
    expect(fileSize).toBeVisible()
    expect(sourceName.parentElement).toContainElement(fileSize)
    expect(sourceName.parentElement).toHaveTextContent("Google Drive·193.65 MB")
  })

  it("renders an opened Direct Media root item with the opened background", () => {
    const directLink: ExtractedLink = {
      url: "https://cdn.example.com/video.mp4",
      label: "video.mp4",
      type: "file",
      expiry: TEST_PLAYABLE_EXPIRY_AT_MS,
    }
    const item: LinkViewItem = {
      url: "https://source.example/video",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Direct Media" },
        extraction: { extractedLinks: [directLink] },
        playback: { openedUrls: [directLink.url], openedIds: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={null}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions()}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    expect(
      screen.getByRole("button", { name: /video.mp4/ }).parentElement
    ).toHaveClass("bg-sky-500/15")
    expect(screen.queryByText("4K HDR")).not.toBeInTheDocument()
    expect(screen.queryByText("New")).not.toBeInTheDocument()
    const expiryMetadata = screen.getByText("Link valid until Jan 1, 2030")
    expect(expiryMetadata).toBeInTheDocument()
    expect(expiryMetadata).toHaveAttribute(
      "title",
      "Expiry for this playable link; the saved item itself does not expire."
    )
  })

  it("renders the root item menu as a full-height trailing cell", () => {
    const directLink: ExtractedLink = {
      url: "https://cdn.example.com/cell-menu.mp4",
      label: "cell-menu.mp4",
      type: "file",
    }
    const item: LinkViewItem = {
      url: "https://source.example/cell-menu",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Direct Media" },
        extraction: { extractedLinks: [directLink] },
        playback: { openedUrls: [], openedIds: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={null}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions()}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    const menuTrigger = screen.getByRole("button", {
      name: "Open menu for https://source.example/cell-menu",
    })
    expect(menuTrigger).toHaveClass("size-full!", "rounded-none!")
    expect(menuTrigger.parentElement).toHaveClass("w-16", "text-foreground")
    expect(menuTrigger.parentElement).not.toHaveClass("border-s")
  })

  it("disables and mutes an expired playable link", () => {
    const play = vi.fn()
    const directLink: ExtractedLink = {
      url: "https://cdn.example.com/expired-video.mp4",
      label: "expired-video.mp4",
      type: "file",
      expiry: Date.now() - 60_000,
    }
    const item: LinkViewItem = {
      url: "https://source.example/expired-video",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Direct Media" },
        extraction: { extractedLinks: [directLink] },
        playback: { openedUrls: [], openedIds: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={null}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions({ play })}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    const filename = screen.getByText("expired-video.mp4")
    const itemButton = screen.getByRole("button", {
      name: "Open expired-video.mp4",
    })
    expect(itemButton).toBeDisabled()
    expect(filename.closest("button")).toBeNull()
    expect(filename.closest("div")).toHaveClass(
      "text-muted-foreground",
      "opacity-60"
    )
    expect(filename).toHaveClass("line-through")
    expect(screen.getByText("Link expired").querySelector("svg")).toBeNull()
    expect(screen.queryByText("New")).not.toBeInTheDocument()
    fireEvent.click(itemButton)
    expect(play).not.toHaveBeenCalled()
  })

  it("shows New on a root folder before it is opened and marks it opened on open", () => {
    const markOpened = vi.fn()
    const item: LinkViewItem = {
      url: "https://source.example/folder",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Folder source" },
        extraction: {
          extractedLinks: [
            {
              id: "folder-one",
              url: "https://source.example/folder/one",
              label: "Folder one",
              type: "folder",
              children: [],
            },
          ],
        },
        playback: { openedUrls: [], openedIds: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={null}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions({ markOpened })}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    const newBadges = screen.getAllByText("New")
    expect(newBadges).toHaveLength(2)
    expect(newBadges[0]).toHaveClass("md:hidden")
    expect(newBadges[1]).toHaveClass("hidden", "md:inline-flex")
    const itemCounts = screen.getAllByText("1 item")
    expect(itemCounts).toHaveLength(1)
    expect(
      Boolean(
        itemCounts[0].compareDocumentPosition(newBadges[0]) &
        Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true)
    const folderButton = screen.getByRole("button", {
      name: "View source.example",
    })
    expect(folderButton.parentElement?.querySelectorAll("svg")).toHaveLength(1)
    fireEvent.click(folderButton)
    expect(markOpened).toHaveBeenCalledWith(item.url, item.url)
  })

  it("uses a spinner for hydration and the shared empty state", () => {
    const commonProps = {
      selectedItemUrl: null,
      onSelectedItemUrlChange: vi.fn(),
      actions: createActions(),
      extractingItems: new Set<string>(),
      highlightedId: null,
    }
    const { rerender } = render(
      <SaveListBrowser items={[]} isHydrating {...commonProps} />
    )

    expect(
      screen.getByRole("status", { name: "Loading saved links…" })
    ).toBeVisible()

    rerender(
      <SaveListBrowser items={[]} isHydrating={false} {...commonProps} />
    )
    const emptyHeading = screen.getByRole("heading", {
      name: "No saved links yet",
    })
    expect(
      screen.queryByText("Add a link to save it for later.")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Add a link" })
    ).not.toBeInTheDocument()
    expect(emptyHeading.parentElement).not.toHaveClass("border", "rounded-2xl")
  })

  it("shows queue status and keeps an incomplete Saved link closed", () => {
    const item: LinkViewItem = {
      id: "queued-link",
      url: "https://source.example/queued",
      timestamp: Date.now(),
      title: "Queued Source",
      metadata: {
        schemaVersion: 3,
        source: {},
        extraction: { extractedLinks: [] },
        playback: { openedUrls: [], openedIds: [] },
      },
      extractionStatus: { state: "running" },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={null}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions()}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    expect(screen.getByText("Loading links")).toBeVisible()
    const row = screen
      .getByText("Queued Source")
      .closest("[data-extraction-state]")
    expect(row).toHaveAttribute("data-extraction-state", "running")
    expect(
      screen.getByRole("button", { name: "Loading links for Queued Source" })
    ).toBeDisabled()
  })
})

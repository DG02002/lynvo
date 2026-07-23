import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { SaveListBrowser } from "~/components/save-list/save-list-browser"
import type { LinkCardActions } from "~/features/links/link-card-actions"
import type { ExtractedLink, RecentLinkViewItem } from "~/features/links/types"
import { withWatchedUrl } from "~/features/links/link-playback-metadata"
import { TEST_PLAYABLE_EXPIRY_AT_MS } from "~/features/links/testing/constants"

const createActions = (
  overrides: Partial<LinkCardActions> = {}
): LinkCardActions => ({
  play: vi.fn(),
  remove: vi.fn(),
  showLinks: vi.fn(),
  markWatched: vi.fn(),
  expandFolder: vi.fn(),
  softRefresh: vi.fn(),
  hardRefresh: vi.fn(),
  expandMirror: vi.fn().mockResolvedValue(null),
  setAsCurrent: vi.fn(),
  ...overrides,
})

describe("SaveListBrowser", () => {
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
    const item: RecentLinkViewItem = {
      url: "https://index.example.com/0:/Collections/",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 2,
        source: { sourceName: "Extractor Source Alpha" },
        extraction: {
          extractedLinks: [
            {
              id: "folder-alpha",
              url: "https://index.example.com/0:/Collections/Folder%20Alpha/",
              label: "Folder Alpha",
              type: "folder",
            },
          ],
        },
        playback: { watchedUrls: [], watchedIds: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[item]}
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
    const expandMirror = vi.fn().mockResolvedValue([
      {
        url: "https://files.example/route-alpha",
        label: "Play from Source Route Alpha",
        type: "file",
        size: "1.2 GB",
      },
    ])
    const item: RecentLinkViewItem = {
      id: "extractor-source-beta-item",
      url: "https://extractor-source-beta.cx/drive/example",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 2,
        source: { sourceName: "Extractor Source Beta" },
        extraction: {
          extractedLinks: [
            {
              id: "extractor-source-beta-container",
              url: "https://extractor-source-beta.cx/drive/example",
              label: "Playable Item Alpha.mkv",
              type: "folder",
              workerNodeKind: "resolvable",
            },
          ],
        },
        playback: { watchedUrls: [], watchedIds: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[item]}
        selectedItemUrl={null}
        onSelectedItemUrlChange={onSelectedItemUrlChange}
        actions={createActions({ expandMirror })}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    fireEvent.click(
      screen.getByRole("button", { name: /Playable Item Alpha.mkv/ })
    )

    expect(
      await screen.findByText("Play from Source Route Alpha")
    ).toBeVisible()
    expect(screen.getByText("Extractor Source Beta")).toBeVisible()
    expect(screen.getByText("1.2 GB")).toBeVisible()
    expect(onSelectedItemUrlChange).not.toHaveBeenCalled()
    expect(expandMirror).toHaveBeenCalledWith(item.url, item.url, false)
  })

  it("resolves a Resolver Beta playable-item inline with loading and watched feedback", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    })
    let finishResolution: (() => void) | undefined
    let resolutionCount = 0
    const markWatched = vi.fn()
    const item: RecentLinkViewItem = {
      id: "resolver-beta-item",
      url: "https://source-alpha.example/collection",
      timestamp: Date.now(),
      title: "Source Alpha collection",
      metadata: {
        schemaVersion: 2,
        source: { sourceName: "Source Alpha" },
        extraction: {
          extractedLinks: [
            {
              id: "playable-item-one",
              url: "https://resolver-beta.example/playable-item-one",
              label: "Playable Item One",
              type: "folder",
              workerNodeKind: "resolvable",
            },
          ],
        },
        playback: { watchedUrls: [], watchedIds: [] },
      },
    }

    const Harness = () => {
      const [extractingItems, setExtractingItems] = useState(new Set<string>())
      const [currentItem, setCurrentItem] = useState(item)
      const actions = createActions({
        markWatched: (itemUrl, linkUrl) => {
          markWatched(itemUrl, linkUrl)
          setCurrentItem((previousItem) => ({
            ...previousItem,
            metadata: withWatchedUrl(
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
            },
            {
              url: `${lazyItemUrl}/route-beta`,
              label: "Play from Source Route Beta Server",
              type: "file",
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
    const playableItemButton = screen.getByRole("button", {
      name: /Playable Item One/,
    })
    fireEvent.click(playableItemButton)

    expect(await screen.findByRole("status", { name: "Loading" })).toBeVisible()
    expect(playableItemButton).toHaveAttribute(
      "data-resolution-state",
      "resolving"
    )
    expect(markWatched).toHaveBeenCalledWith(
      item.url,
      "https://resolver-beta.example/playable-item-one"
    )

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
    expect(markWatched).toHaveBeenCalledWith(
      item.url,
      "https://resolver-beta.example/playable-item-one"
    )
    expect(playableItemButton).toHaveClass("bg-sky-500/15")
    expect(playableItemButton).toHaveAttribute(
      "data-resolution-state",
      "expanded"
    )
    expect(
      screen.getAllByRole("button", { name: "Open link menu" })
    ).toHaveLength(2)
    expect(
      screen.getByRole("button", { name: "Open resolvable item menu" })
    ).toBeInTheDocument()

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
    const markWatched = vi.fn()
    const item: RecentLinkViewItem = {
      url: "https://source-alpha.example/failure",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 2,
        source: { sourceName: "Source Alpha" },
        extraction: {
          extractedLinks: [
            {
              id: "failed-playable-item",
              url: "https://resolver-beta.example/resolution-failure",
              label: "Playable Item Resolution Failure",
              type: "folder",
              workerNodeKind: "resolvable",
            },
          ],
        },
        playback: { watchedUrls: [], watchedIds: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[item]}
        selectedItemUrl={item.url}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions({
          markWatched,
          expandMirror: vi.fn().mockResolvedValue(null),
        })}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    const failedPlayableItemButton = screen.getByRole("button", {
      name: /Playable Item Resolution Failure/,
    })
    fireEvent.click(failedPlayableItemButton)

    await waitFor(() => {
      expect(failedPlayableItemButton).toHaveAttribute(
        "data-resolution-state",
        "failed"
      )
    })
    expect(failedPlayableItemButton).toHaveClass("bg-destructive/15")
    expect(markWatched).toHaveBeenCalledWith(
      item.url,
      "https://resolver-beta.example/resolution-failure"
    )
  })

  it("renders a watched direct root item with the watched background", () => {
    const directLink: ExtractedLink = {
      url: "https://cdn.example.com/video.mp4",
      label: "video.mp4",
      type: "file",
      expiry: TEST_PLAYABLE_EXPIRY_AT_MS,
    }
    const item: RecentLinkViewItem = {
      url: "https://source.example/video",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 2,
        source: { sourceName: "Direct Link" },
        extraction: { extractedLinks: [directLink] },
        playback: { watchedUrls: [directLink.url], watchedIds: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[item]}
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
    expect(screen.getByText("Expires Jan 1, 2030")).toBeInTheDocument()
  })

  it("shows New on an unclicked root folder and marks it watched on open", () => {
    const markWatched = vi.fn()
    const item: RecentLinkViewItem = {
      url: "https://source.example/folder",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 2,
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
        playback: { watchedUrls: [], watchedIds: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[item]}
        selectedItemUrl={null}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions({ markWatched })}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    expect(screen.getByText("New")).toBeInTheDocument()
    const newBadge = screen.getByText("New")
    const itemCount = screen.getByText("1 items")
    expect(
      Boolean(
        newBadge.compareDocumentPosition(itemCount) &
        Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: /folder/i }))
    expect(markWatched).toHaveBeenCalledWith(item.url, item.url)
  })

  it("uses a spinner for hydration and a plain empty state", () => {
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

    expect(screen.getByRole("status", { name: "Loading" })).toBeVisible()

    rerender(
      <SaveListBrowser items={[]} isHydrating={false} {...commonProps} />
    )
    const emptyHeading = screen.getByText("No saved links")
    expect(emptyHeading.parentElement?.parentElement).not.toHaveClass(
      "border",
      "rounded-2xl"
    )
  })
})

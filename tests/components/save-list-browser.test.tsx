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
        id: "mission-impossible",
        url: "https://index.example.com/0:/Movies/Mission%20Impossible/",
        label: "Mission Impossible",
        type: "folder",
        childrenResolved: true,
        children: [
          {
            id: "movie-1",
            url: "https://index.example.com/0:/Movies/Mission%20Impossible/movie.mkv",
            label: "movie.mkv",
            type: "file",
          },
        ],
      },
    ]
    const expandFolder = vi.fn().mockResolvedValue(resolvedLinks)
    const item: RecentLinkViewItem = {
      url: "https://index.example.com/0:/Movies/",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 2,
        source: { sourceName: "Bhadoo’s Google Drive Index" },
        extraction: {
          extractedLinks: [
            {
              id: "mission-impossible",
              url: "https://index.example.com/0:/Movies/Mission%20Impossible/",
              label: "Mission Impossible",
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
      name: /Mission Impossible/,
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
        "mission-impossible",
        "https://index.example.com/0:/Movies/Mission%20Impossible/"
      )
    )
    expect(await screen.findByText("movie.mkv")).toBeVisible()
    expect(
      screen.getByRole("button", { name: /Mission Impossible/ })
    ).toHaveAttribute("data-folder-state", "open")
  })

  it("backfills HubCloud attribution for legacy resolvable nodes", () => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    })
    const item: RecentLinkViewItem = {
      url: "https://4khdhub.one/example-series-123",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 2,
        source: { sourceName: "4kHDHub" },
        extraction: {
          extractedLinks: [
            {
              id: "legacy-hubcloud-node",
              url: "https://hubcloud.cx/drive/example",
              label: "Episode One",
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
        actions={createActions()}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    expect(screen.getByText("HubCloud")).toBeVisible()
    expect(screen.queryByText("4kHDHub")).not.toBeInTheDocument()
  })

  it("shows a single resolvable container directly on the save page", async () => {
    const onSelectedItemUrlChange = vi.fn()
    const expandMirror = vi.fn().mockResolvedValue([
      {
        url: "https://files.example/fsl",
        label: "Play from FSL Server",
        type: "file",
        size: "1.2 GB",
      },
    ])
    const item: RecentLinkViewItem = {
      id: "hubcloud-item",
      url: "https://hubcloud.cx/drive/example",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 2,
        source: { sourceName: "HubCloud" },
        extraction: {
          extractedLinks: [
            {
              id: "hubcloud-container",
              url: "https://hubcloud.cx/drive/example",
              label: "Movie.Name.2026.mkv",
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

    fireEvent.click(screen.getByRole("button", { name: /Movie.Name.2026.mkv/ }))

    expect(await screen.findByText("Play from FSL Server")).toBeVisible()
    expect(screen.getByText("HubCloud")).toBeVisible()
    expect(screen.getByText("1.2 GB")).toBeVisible()
    expect(onSelectedItemUrlChange).not.toHaveBeenCalled()
    expect(expandMirror).toHaveBeenCalledWith(item.url, item.url, false)
  })

  it("resolves a Resolver Beta episode inline with loading and watched feedback", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    })
    let finishResolution: (() => void) | undefined
    let resolutionCount = 0
    const markWatched = vi.fn()
    const item: RecentLinkViewItem = {
      id: "resolver-beta-item",
      url: "https://source-alpha.example/series",
      timestamp: Date.now(),
      title: "Source Alpha series",
      metadata: {
        schemaVersion: 2,
        source: { sourceName: "Source Alpha" },
        extraction: {
          extractedLinks: [
            {
              id: "episode-one",
              url: "https://resolver-beta.example/episode-one",
              label: "Episode One",
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
        expandMirror: async (_, episodeUrl) => {
          resolutionCount += 1
          setExtractingItems((currentItems) =>
            new Set(currentItems).add(episodeUrl)
          )
          await new Promise<void>((resolve) => {
            finishResolution = resolve
          })
          setExtractingItems(new Set())
          return [
            {
              url: `${episodeUrl}/fsl`,
              label: "Play from FSL Server",
              type: "file",
            },
            {
              url: `${episodeUrl}/s3`,
              label: "Play from S3 Server",
              type: "file",
            },
            {
              url: `${episodeUrl}/cf-down`,
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
    const episodeButton = screen.getByRole("button", { name: /Episode One/ })
    fireEvent.click(episodeButton)

    expect(await screen.findByRole("status", { name: "Loading" })).toBeVisible()
    expect(episodeButton).toHaveAttribute("data-resolution-state", "resolving")
    expect(markWatched).toHaveBeenCalledWith(
      item.url,
      "https://resolver-beta.example/episode-one"
    )

    finishResolution?.()

    await waitFor(() => {
      expect(screen.getByText("Play from FSL Server")).toBeInTheDocument()
      expect(screen.getByText("Play from S3 Server")).toBeInTheDocument()
    })
    expect(screen.queryByText("FSL")).not.toBeInTheDocument()
    expect(screen.queryByText("S3")).not.toBeInTheDocument()
    expect(
      screen.queryByText("Play from CF Server (404)")
    ).not.toBeInTheDocument()
    expect(markWatched).toHaveBeenCalledWith(
      item.url,
      "https://resolver-beta.example/episode-one"
    )
    expect(episodeButton).toHaveClass("bg-sky-500/15")
    expect(episodeButton).toHaveAttribute("data-resolution-state", "expanded")
    expect(
      screen.getAllByRole("button", { name: "Open link menu" })
    ).toHaveLength(2)
    expect(
      screen.getByRole("button", { name: "Open resolvable item menu" })
    ).toBeInTheDocument()

    fireEvent.click(episodeButton)
    await waitFor(() => {
      expect(screen.queryByText("Play from FSL Server")).not.toBeInTheDocument()
    })
    expect(episodeButton).toHaveAttribute("data-resolution-state", "collapsed")
    fireEvent.click(episodeButton)
    expect(await screen.findByText("Play from FSL Server")).toBeVisible()
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
              id: "failed-episode",
              url: "https://resolver-beta.example/resolution-failure",
              label: "Episode Resolution Failure",
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

    const failedEpisodeButton = screen.getByRole("button", {
      name: /Episode Resolution Failure/,
    })
    fireEvent.click(failedEpisodeButton)

    await waitFor(() => {
      expect(failedEpisodeButton).toHaveAttribute(
        "data-resolution-state",
        "failed"
      )
    })
    expect(failedEpisodeButton).toHaveClass("bg-destructive/15")
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

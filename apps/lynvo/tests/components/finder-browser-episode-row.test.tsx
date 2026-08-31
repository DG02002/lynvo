import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SaveListBrowser } from "~/components/save-list/save-list-browser"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import type { LinkViewItem } from "~/features/links/types"

interface MediaArtworkBatchRequest {
  readonly requests: readonly MediaArtworkRequest[]
}

const episodeFilename = "Sample.Series.Name.S01E01.1080p.PROV.WEB-DL.mkv"
const localStorageValues = new Map<string, string>()
const localStorageStub = {
  getItem: (key: string) => localStorageValues.get(key) ?? null,
  setItem: (key: string, value: string) => {
    localStorageValues.set(key, value)
  },
  clear: () => localStorageValues.clear(),
}

const createMediaArtworkFetch = () =>
  vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    // SAFETY: the test fetch receives the JSON body produced by the artwork client
    const requestBody = JSON.parse(
      String(init?.body)
    ) as MediaArtworkBatchRequest
    const results = requestBody.requests.map((request) =>
      request.episodeNumber === undefined
        ? {}
        : { stillPath: "/episode-1.jpg", episodeTitle: "Episode 1" }
    )
    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" },
    })
  })

const createActions = (): LinkItemActions => ({
  play: vi.fn().mockResolvedValue({ accepted: true }),
  remove: vi.fn(),
  showLinks: vi.fn(),
  markOpened: vi.fn(),
  expandFolder: vi.fn(),
  softRefresh: vi.fn(),
  hardRefresh: vi.fn(),
  expandMirror: vi.fn().mockResolvedValue(null),
})

const item: LinkViewItem = {
  kind: "saved",
  id: "sample-series-name",
  url: "https://media.example/sample-series-name",
  timestamp: Date.now(),
  title: "Sample Series Name",
  metadata: {
    schemaVersion: 3,
    source: { sourceName: "Streambox" },
    extraction: {
      extractedLinks: [
        {
          id: "sample-series-name-episode-1",
          url: "https://media.example/sample-series-name-episode-1",
          label: episodeFilename,
          type: "file",
          size: "1.05 GB",
        },
      ],
    },
    playback: { openedUrls: [] },
  },
}

const movieItem: LinkViewItem = {
  ...item,
  id: "feature-movie",
  url: "https://media.example/feature-movie",
  title: "Feature (2026)",
  metadata: {
    ...item.metadata,
    extraction: {
      ...item.metadata.extraction,
      extractedLinks: [
        {
          id: "feature-movie-file",
          url: "https://media.example/feature-movie-file",
          label: "Feature.2026.1080p.mkv",
          type: "file",
          size: "1.05 GB",
        },
      ],
    },
  },
}

// Golden fixture mirrored from a real saved link: a "New" wrapper whose only
// child is a mirror-classified resolvable season folder with playable episodes.
const wrappedSeasonItem: LinkViewItem = {
  ...item,
  id: "wrapped-season",
  url: "https://media.example/wrapped-season",
  title: "New",
  metadata: {
    ...item.metadata,
    extraction: {
      ...item.metadata.extraction,
      extractedLinks: [
        {
          nodeKey:
            "0:resolvable:wQbRWuzsoAF+I/pDt+v482JXM4hxqzdeWIC3p0CMHYgcKgF/fpGoSCPX4Z/tGj1M",
          nodeUrl:
            "https://media.example/wrapped-season/Stranger.Things.S05.1080p.NF.WEB-DL.Multi.DD+5.1.Atmos.H.265-CPTN5DW/",
          label:
            "Stranger.Things.S05.1080p.NF.WEB-DL.Multi.DD+5.1.Atmos.H.265-CPTN5DW",
          id: "wQbRWuzsoAF+I/pDt+v482JXM4hxqzdeWIC3p0CMHYgcKgF/fpGoSCPX4Z/tGj1M",
          type: "folder",
          mediaNodeKind: "resolvable",
          childrenResolved: true,
          children: [
            {
              nodeKey:
                "0:playable:cjut/qH6h6EZjdLd/9dJi2Hmz3h+S7Jf+ISEpCLeUeGafvSCiDsjKpVoYM4xVoBk",
              url: "https://media.example/wrapped-season/download-e1",
              label:
                "Stranger.Things.S05E01.Chapter.One.The.Crawl.1080p.NF.WEB-DL.Multi.DD+5.1.Atmos.H.265-CPTN5DW.mkv",
              id: "cjut/qH6h6EZjdLd/9dJi2Hmz3h+S7Jf+ISEpCLeUeGafvSCiDsjKpVoYM4xVoBk",
              type: "file",
              size: "2.59 GB",
              mediaNodeKind: "playable",
            },
            {
              nodeKey:
                "1:playable:FM7PpwjPoqtYTlRNNFgru4jPM+pxOY3fLNOaWNSgSZZ4+NDQCeiJRPUbYjXgoT8k",
              url: "https://media.example/wrapped-season/download-e2",
              label:
                "Stranger.Things.S05E02.Chapter.Two.The.Vanishing.of.1080p.NF.WEB-DL.Multi.DD+5.1.Atmos.H.265-CPTN5DW.mkv",
              id: "FM7PpwjPoqtYTlRNNFgru4jPM+pxOY3fLNOaWNSgSZZ4+NDQCeiJRPUbYjXgoT8k",
              type: "file",
              size: "2.59 GB",
              mediaNodeKind: "playable",
            },
          ],
        },
      ],
    },
  },
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  })
  localStorageValues.clear()
  vi.stubGlobal("localStorage", localStorageStub)
  vi.stubGlobal("fetch", createMediaArtworkFetch())
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
})

afterEach(() => {
  localStorageValues.clear()
  vi.clearAllMocks()
})

describe("FinderBrowser episode rows", () => {
  it("hides the episode-name control for movie folders", () => {
    render(
      <SaveListBrowser
        items={[movieItem]}
        selectedItemUrl={movieItem.url}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions()}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
        shouldShowRowPosters
      />
    )

    expect(
      screen.queryByRole("switch", { name: "Episode names" })
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Episode names")).not.toBeInTheDocument()
    expect(screen.queryByText("Show episode names")).not.toBeInTheDocument()

    const headerMenu = screen.getByRole("button", {
      name: "Open menu for Feature (2026)",
    })
    const folderHeader = headerMenu.closest("header")
    expect(folderHeader).toHaveClass(
      "grid-cols-[4rem_minmax(0,1fr)_auto_4rem]",
      "md:grid-cols-[18rem_minmax(0,1fr)_auto_4rem]"
    )
    expect(headerMenu.parentElement).toHaveClass("col-start-4")
    expect(folderHeader?.lastElementChild).toBe(headerMenu.parentElement)
  })

  it("keeps the header menu right-aligned for long movie folder titles", () => {
    const longMovieTitle =
      "Feature (2026) — An Extremely Long Folder Title That Must Truncate In The Browser Header"
    render(
      <SaveListBrowser
        items={[{ ...movieItem, title: longMovieTitle }]}
        selectedItemUrl={movieItem.url}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions()}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
        shouldShowRowPosters
      />
    )

    const headerMenu = screen.getByRole("button", {
      name: `Open menu for ${longMovieTitle}`,
    })
    const folderHeader = headerMenu.closest("header")
    expect(folderHeader).toHaveClass(
      "md:grid-cols-[18rem_minmax(0,1fr)_auto_4rem]"
    )
    expect(folderHeader?.lastElementChild).toBe(headerMenu.parentElement)
    expect(screen.getByRole("heading", { name: longMovieTitle })).toHaveClass(
      "hidden",
      "md:block"
    )
  })

  it("uses numbered episode names and inline source metadata for folder files", async () => {
    const view = render(
      <SaveListBrowser
        items={[item]}
        selectedItemUrl={item.url}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions()}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
        shouldShowRowPosters
      />
    )

    const headerMenu = screen.getByRole("button", {
      name: "Open menu for Sample Series Name",
    })
    const folderHeader = headerMenu.closest("header")
    expect(folderHeader).toHaveClass(
      "grid-cols-[4rem_minmax(0,1fr)_auto_4rem]",
      "md:grid-cols-[18rem_minmax(0,1fr)_auto_4rem]",
      "lg:grid-cols-[22rem_minmax(0,1fr)_auto_4rem]"
    )
    expect(folderHeader?.lastElementChild).toBe(headerMenu.parentElement)
    expect(
      screen.getByRole("switch", { name: "Episode names" })
    ).toBeInTheDocument()
    await screen.findByText("1. Episode 1")
    const sourceName = screen.getByText("Streambox")
    const fileSize = screen.getByText("1.05 GB")
    expect(sourceName.parentElement).toContainElement(fileSize)
    expect(sourceName.parentElement).toHaveTextContent("Streambox·1.05 GB")
    expect(screen.getAllByText("1.05 GB")).toHaveLength(1)
    await waitFor(() => {
      const episodeImage = view.container.querySelector(
        'img[src*="episode-1.jpg"]'
      )
      expect(episodeImage?.closest(".hidden")).toBeNull()
    })
  })

  it("renders a one-season folder with the season poster panel", async () => {
    const view = render(
      <SaveListBrowser
        items={[item]}
        selectedItemUrl={item.url}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions()}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
        shouldShowRowPosters
      />
    )

    expect(
      screen.getByRole("heading", { name: "Sample Series Name S01" })
    ).toBeInTheDocument()
    expect(await screen.findByText("No poster found")).toBeInTheDocument()
    expect(
      view.container.querySelector(".save-list-group-artwork-frame")
    ).toBeInTheDocument()
  })

  it("descends through a single season-folder wrapper into the season view", async () => {
    render(
      <SaveListBrowser
        items={[wrappedSeasonItem]}
        selectedItemUrl={wrappedSeasonItem.url}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions()}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
        shouldShowRowPosters
      />
    )

    expect(
      screen.getByRole("heading", { name: "Stranger Things S05" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("switch", { name: "Episode names" })
    ).toBeInTheDocument()
    expect(
      await screen.findByRole("button", { name: "1. Episode 1" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "2. Episode 1" })
    ).toBeInTheDocument()
  })

  it("keeps the season view when sidecar files ride along", () => {
    const seasonWithSidecarsItem: LinkViewItem = {
      ...item,
      metadata: {
        ...item.metadata,
        extraction: {
          ...item.metadata.extraction,
          extractedLinks: [
            ...item.metadata.extraction.extractedLinks,
            {
              id: "sample-series-name-subtitle",
              url: "https://media.example/sample-series-name-subtitle",
              label: "Sample.Series.Name.S01E01.1080p.PROV.WEB-DL.srt",
              type: "file",
              size: "48 KB",
            },
            {
              id: "sample-series-name-poster",
              url: "https://media.example/sample-series-name-poster",
              label: "poster.jpg",
              type: "file",
              size: "220 KB",
            },
          ],
        },
      },
    }

    render(
      <SaveListBrowser
        items={[seasonWithSidecarsItem]}
        selectedItemUrl={seasonWithSidecarsItem.url}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions()}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
        shouldShowRowPosters
      />
    )

    expect(
      screen.getByRole("heading", { name: "Sample Series Name S01" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("switch", { name: "Episode names" })
    ).toBeInTheDocument()
  })

  it("descends once a lazy wrapper resolves after the page opens", async () => {
    const lazyWrapperItem: LinkViewItem = {
      ...wrappedSeasonItem,
      metadata: {
        ...wrappedSeasonItem.metadata,
        extraction: {
          ...wrappedSeasonItem.metadata.extraction,
          extractedLinks: [
            {
              nodeKey:
                "0:resolvable:wQbRWuzsoAF+I/pDt+v482JXM4hxqzdeWIC3p0CMHYgcKgF/fpGoSCPX4Z/tGj1M",
              nodeUrl:
                "https://media.example/wrapped-season/Stranger.Things.S05.1080p.NF.WEB-DL.Multi.DD+5.1.Atmos.H.265-CPTN5DW/",
              label:
                "Stranger.Things.S05.1080p.NF.WEB-DL.Multi.DD+5.1.Atmos.H.265-CPTN5DW",
              id: "wQbRWuzsoAF+I/pDt+v482JXM4hxqzdeWIC3p0CMHYgcKgF/fpGoSCPX4Z/tGj1M",
              type: "folder",
              mediaNodeKind: "resolvable",
            },
          ],
        },
      },
    }
    const resolvedWrapperItem = wrappedSeasonItem

    const view = render(
      <SaveListBrowser
        items={[lazyWrapperItem]}
        selectedItemUrl={lazyWrapperItem.url}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions()}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
        shouldShowRowPosters
      />
    )
    expect(
      screen.queryByRole("heading", { name: "Stranger Things S05" })
    ).not.toBeInTheDocument()

    view.rerender(
      <SaveListBrowser
        items={[resolvedWrapperItem]}
        selectedItemUrl={resolvedWrapperItem.url}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions()}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
        shouldShowRowPosters
      />
    )

    expect(
      await screen.findByRole("heading", { name: "Stranger Things S05" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("switch", { name: "Episode names" })
    ).toBeInTheDocument()
  })

  it("keeps the folder tree for folders mixing seasons", () => {
    const mixedSeasonsItem: LinkViewItem = {
      ...item,
      metadata: {
        ...item.metadata,
        extraction: {
          ...item.metadata.extraction,
          extractedLinks: [
            ...item.metadata.extraction.extractedLinks,
            {
              id: "sample-series-name-s02e01",
              url: "https://media.example/sample-series-name-s02e01",
              label: "Sample.Series.Name.S02E01.1080p.PROV.WEB-DL.mkv",
              type: "file",
              size: "1.05 GB",
            },
          ],
        },
      },
    }

    render(
      <SaveListBrowser
        items={[mixedSeasonsItem]}
        selectedItemUrl={mixedSeasonsItem.url}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions()}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
        shouldShowRowPosters
      />
    )

    const headerMenu = screen.getByRole("button", {
      name: "Open menu for Sample Series Name",
    })
    const folderHeader = headerMenu.closest("header")
    expect(folderHeader).toHaveClass(
      "md:grid-cols-[18rem_minmax(0,1fr)_auto_4rem]"
    )
    expect(
      screen.queryByRole("heading", { name: "Sample Series Name S01" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Sample Series Name" })
    ).toBeInTheDocument()
  })
})

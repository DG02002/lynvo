import { MemoryRouter } from "react-router"
import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LibrarySaveList } from "~/features/links/components/library-save-list"
import { TitleGroupCard } from "~/features/links/components/title-group-card"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import type { LinkListItem } from "~/features/links/types"

const createItem = (
  id: string,
  label: string,
  timestamp = new Date(2026, 7, 23, 12).getTime()
): LinkListItem => ({
  kind: "saved",
  id,
  url: `https://source.example/${id}`,
  timestamp,
  metadata: {
    schemaVersion: 3,
    source: {},
    extraction: {
      extractedLinks: [
        {
          nodeKey: `${id}:node`,
          url: `https://media.example/${id}.mkv`,
          label,
          type: "file",
          mediaNodeKind: "playable",
        },
      ],
    },
    playback: { openedUrls: [] },
  },
})

const createActions = (): LinkItemActions => ({
  play: vi.fn().mockResolvedValue({ accepted: true }),
  remove: vi.fn(),
  showLinks: vi.fn(),
  markOpened: vi.fn(),
  expandFolder: vi.fn().mockResolvedValue(null),
  softRefresh: vi.fn(),
  hardRefresh: vi.fn(),
  expandMirror: vi.fn().mockResolvedValue(null),
})

const renderList = (items: LinkListItem[], actions?: LinkItemActions) =>
  render(
    <MemoryRouter>
      <LibrarySaveList items={items} isPending={false} actions={actions} />
    </MemoryRouter>
  )

describe("LibrarySaveList", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 23, 15))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders one title card with multiple episodes in the same season", () => {
    renderList([
      createItem("episode-one", "Example Show S01E01 1080p.mkv"),
      createItem("episode-two", "Example Show S01E02 1080p.mkv"),
    ])

    expect(screen.getAllByTestId("title-group-card")).toHaveLength(1)
    expect(
      screen
        .getAllByTestId("title-group-card")[0]
        ?.querySelectorAll('[data-slot="skeleton"]')
    ).toHaveLength(2)
    expect(screen.queryByText("Season 1")).not.toBeInTheDocument()
    expect(screen.queryByText(/sources?/i)).not.toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Today" })).toHaveAttribute(
      "data-layout",
      "poster-grid"
    )
  })

  it("renders a skeleton while artwork is pending", () => {
    const group: TitleGroupProjection = {
      id: "pending-group",
      identityKey: "movie:doctor strange:2016",
      mediaKind: "movie",
      displayTitle: "Doctor Strange",
      year: 2016,
      metadataState: "pending",
      lastAddedAt: 1,
      sourceCount: 0,
      entries: [],
    }

    const { container } = render(
      <MemoryRouter>
        <TitleGroupCard group={group} savedLinks={[]} />
      </MemoryRouter>
    )

    expect(
      container.querySelector('[data-slot="skeleton"]')
    ).toBeInTheDocument()
    expect(
      container.querySelectorAll(".title-group-card__skeleton")
    ).toHaveLength(2)
    expect(screen.queryByText("Finding artwork")).not.toBeInTheDocument()
  })

  it("shows a centered missing-poster message without repeating the title", () => {
    const group: TitleGroupProjection = {
      id: "missing-poster-group",
      identityKey: "movie:the lord of the rings:2002",
      mediaKind: "movie",
      displayTitle: "The Lord of the Rings: The Two Towers",
      year: 2002,
      metadataState: "failed",
      lastAddedAt: 1,
      sourceCount: 0,
      entries: [],
    }

    render(
      <MemoryRouter>
        <TitleGroupCard group={group} savedLinks={[]} />
      </MemoryRouter>
    )

    const card = screen.getByTestId("title-group-card")
    const posterArea = card.querySelector('[class~="aspect-2/3"]')
    expect(screen.getByText("No poster found")).toHaveClass(
      "items-center",
      "justify-center"
    )
    expect(posterArea).toBeInTheDocument()
    expect(posterArea).not.toHaveTextContent(group.displayTitle)
    expect(screen.getAllByText(group.displayTitle)).toHaveLength(1)
    expect(screen.queryByText("Not found")).not.toBeInTheDocument()
    expect(screen.queryByText("No artwork")).not.toBeInTheDocument()
  })

  it("keeps different seasons as separate title cards", () => {
    renderList([
      createItem("season-one", "Example Show S01E01.mkv"),
      createItem("season-two", "Example Show S02E01.mkv"),
    ])

    expect(screen.getAllByTestId("title-group-card")).toHaveLength(2)
    expect(
      screen
        .getAllByTestId("title-group-card")
        .flatMap((card) => [...card.querySelectorAll('[data-slot="skeleton"]')])
    ).toHaveLength(4)
  })

  it("keeps unmatched sources visible in an Unmatched rail", () => {
    renderList([createItem("unknown", "video.mkv")])

    expect(screen.getByRole("heading", { name: "Unmatched" })).toBeVisible()
    expect(screen.getAllByText("video.mkv")).toHaveLength(1)
  })

  it("shows a clear empty state", () => {
    renderList([])

    expect(
      screen.getByRole("heading", { name: "No saved links yet" })
    ).toBeVisible()
    expect(
      screen.getByText(
        "Save a movie, show, or folder to start building your library."
      )
    ).toBeVisible()
  })

  it("shows a centered recovery state when the library cannot load", () => {
    render(
      <MemoryRouter>
        <LibrarySaveList
          items={[]}
          isPending={false}
          error="Unable to load media library"
          onRetry={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(
      screen.getByRole("alert", {
        name: "Library temporarily unavailable",
      })
    ).toHaveClass("items-center")
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible()
  })

  it("keeps the cached library visible when a refresh fails", () => {
    const cachedProjection: TitleProjection = {
      dateGroups: [
        {
          key: "today",
          label: "Today",
          groups: [
            {
              identityKey: "movie:cached-library:2026",
              mediaKind: "movie",
              displayTitle: "Cached library",
              year: 2026,
              metadataState: "unavailable",
              lastAddedAt: 1,
              sourceCount: 0,
              entries: [],
            },
          ],
        },
      ],
      unmatchedGroups: [],
    }

    render(
      <MemoryRouter>
        <LibrarySaveList
          items={[]}
          isPending={false}
          projection={cachedProjection}
          error="Unable to load media library"
          onRetry={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(screen.getByTestId("title-group-card")).toBeVisible()
    expect(screen.getByRole("status")).toBeVisible()
    expect(screen.getByText(/Showing your last saved library/i)).toBeVisible()
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("keeps the shared empty state when a cached empty library cannot refresh", () => {
    render(
      <MemoryRouter>
        <LibrarySaveList
          items={[]}
          isPending={false}
          projection={{ dateGroups: [], unmatchedGroups: [] }}
          error="Unable to load media library"
          onRetry={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(
      screen.getByRole("heading", { name: "No saved links yet" })
    ).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Try again" })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("uses a spinner instead of poster skeletons while saved links load", () => {
    const { container } = render(
      <MemoryRouter>
        <LibrarySaveList items={[]} isPending={true} />
      </MemoryRouter>
    )

    expect(
      screen.getByRole("status", { name: "Loading media library" })
    ).toBeVisible()
    expect(
      container.querySelector('[data-slot="skeleton"]')
    ).not.toBeInTheDocument()
    expect(screen.queryByText("No saved links yet")).not.toBeInTheDocument()
  })

  it("reuses the saved-link menu on a media card", () => {
    renderList(
      [createItem("movie", "Example Movie (2026).mkv")],
      createActions()
    )

    expect(
      screen.getByRole("button", { name: /Open menu for/i })
    ).toBeInTheDocument()
  })

  it("opens a direct media card in the Library title detail view", () => {
    const item = createItem("direct-media", "direct-media.mkv")
    const group: TitleGroupProjection = {
      id: "direct-media-group",
      identityKey: "unmatched:direct-media",
      mediaKind: "unmatched",
      displayTitle: "direct-media.mkv",
      metadataState: "unavailable",
      lastAddedAt: item.timestamp,
      sourceCount: 1,
      entries: [
        {
          entryKey: "source:direct-media",
          kind: "unknown",
          displayLabel: "direct-media.mkv",
          metadataState: "unavailable",
          sources: [
            {
              savedLinkId: item.id!,
              occurrenceKey: "direct-media",
              nodeKey: "direct-media:node",
              nodePath: "0",
              label: "direct-media.mkv",
              sourceName: "Direct Media",
              node: item.metadata.extraction.extractedLinks[0]!,
              timestamp: item.timestamp,
            },
          ],
        },
      ],
    }

    render(
      <MemoryRouter>
        <TitleGroupCard
          group={group}
          savedLinks={[item]}
          actions={createActions()}
        />
      </MemoryRouter>
    )

    expect(
      screen.getByRole("link", { name: "Open direct-media.mkv" })
    ).toHaveAttribute("href", "/save/title/direct-media-group")
    expect(screen.getByText("New")).toBeVisible()
  })

  it("links matched movies and shows to their kind detail routes", () => {
    const item = createItem("matched-media", "Example Movie (2026).mkv")
    const movieGroup: TitleGroupProjection = {
      id: "movie-group-id",
      identityKey: "movie:example movie:2026",
      mediaKind: "movie",
      displayTitle: "Example Movie",
      metadataState: "unavailable",
      lastAddedAt: item.timestamp,
      sourceCount: 1,
      entries: [],
    }
    const showGroup: TitleGroupProjection = {
      id: "show group id",
      identityKey: "tv-season:example show:1",
      mediaKind: "tv-season",
      displayTitle: "Example Show",
      metadataState: "unavailable",
      lastAddedAt: item.timestamp,
      sourceCount: 1,
      entries: [],
    }

    const { unmount } = render(
      <MemoryRouter>
        <TitleGroupCard
          group={movieGroup}
          savedLinks={[item]}
          actions={createActions()}
        />
      </MemoryRouter>
    )
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/save/movie/movie-group-id"
    )
    unmount()

    render(
      <MemoryRouter>
        <TitleGroupCard
          group={showGroup}
          savedLinks={[item]}
          actions={createActions()}
        />
      </MemoryRouter>
    )
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/save/show/show%20group%20id"
    )
  })
})

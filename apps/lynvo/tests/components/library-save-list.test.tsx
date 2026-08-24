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
    playback: { openedUrls: [], openedIds: [] },
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
    expect(screen.queryByText("Finding artwork")).not.toBeInTheDocument()
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
    expect(screen.getAllByText("video.mkv")).toHaveLength(2)
  })

  it("shows a clear empty state", () => {
    renderList([])

    expect(screen.getByText("No saved media yet")).toBeVisible()
    expect(
      screen.getByText("Save a movie, show, or folder to organize it here.")
    ).toBeVisible()
  })

  it("keeps the loading state visible until saved links finish loading", () => {
    render(
      <MemoryRouter>
        <LibrarySaveList items={[]} isPending={true} />
      </MemoryRouter>
    )

    expect(
      screen.getByRole("status", { name: "Loading media library" })
    ).toBeVisible()
    expect(screen.queryByText("No saved media yet")).not.toBeInTheDocument()
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

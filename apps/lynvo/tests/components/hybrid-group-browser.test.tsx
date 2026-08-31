import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HybridGroupBrowser } from "~/components/save-list/hybrid-group-browser"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import type { LinkListItem } from "~/features/links/types"

interface MediaArtworkBatchRequest {
  readonly requests: readonly MediaArtworkRequest[]
}

const episodeFilename =
  "Sample.Series.Sample-Arc.War.S04E01.TAG.OF.TAGS.1080p.mkv"
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
        ? {
            posterPath: "/season-poster.jpg",
            identity: { providerId: 1, title: "Sample", year: 2004 },
          }
        : {
            stillPath: `/episode-still-${request.episodeNumber}.jpg`,
            episodeTitle:
              request.episodeNumber === 1
                ? "The Sample Battle"
                : `Episode ${request.episodeNumber}`,
          }
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

const createEpisodeItem = (
  itemId = "sample-episode-1",
  filename = episodeFilename
): LinkListItem => ({
  kind: "saved",
  id: itemId,
  url: `https://media.example/${itemId}`,
  timestamp: Date.now(),
  title: filename,
  metadata: {
    schemaVersion: 3,
    source: { sourceName: "StreamLive" },
    extraction: {
      extractedLinks: [
        {
          id: "sample-episode-1-link",
          url: "https://media.example/sample-episode-1.mkv",
          label: filename,
          type: "file",
          size: "597.62 MB",
        },
      ],
    },
    playback: { openedUrls: [] },
  },
})

const renderBrowser = (
  items: readonly LinkListItem[] = [createEpisodeItem()],
  overrides: { actions?: LinkItemActions; onExit?: () => void } = {}
) => {
  const actions = overrides.actions ?? createActions()
  const onExit = overrides.onExit ?? vi.fn()
  const view = render(
    <HybridGroupBrowser
      group={{
        key: "tv:sample series sample arc::S04",
        displayTitle: "Sample Series Sample Arc S04",
        artworkRequest: {
          mediaKind: "tv",
          title: "Sample Series Sample Arc",
          seasonNumber: 4,
        },
        lastAddedAt: Date.now(),
        items,
      }}
      actions={actions}
      extractingItems={new Set()}
      onExit={onExit}
      onOpenItem={vi.fn()}
    />
  )
  return { ...view, actions, onExit }
}

const renderNonEpisodeGroupBrowser = () =>
  render(
    <HybridGroupBrowser
      group={{
        key: "folder:ordinary-downloads",
        displayTitle: "Ordinary Downloads",
        lastAddedAt: Date.now(),
        items: [createEpisodeItem("ordinary-download", "downloaded-video.mkv")],
      }}
      actions={createActions()}
      extractingItems={new Set()}
      onExit={vi.fn()}
      onOpenItem={vi.fn()}
    />
  )

beforeEach(() => {
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

describe("HybridGroupBrowser", () => {
  it("hides episode names for non-episodic groups", () => {
    renderNonEpisodeGroupBrowser()

    expect(
      screen.queryByRole("switch", { name: "Episode names" })
    ).not.toBeInTheDocument()
    expect(screen.getByText("downloaded-video.mkv")).toBeInTheDocument()
    expect(screen.getByRole("banner").children).toHaveLength(3)
    expect(
      screen.getByRole("button", { name: "downloaded-video.mkv" }).parentElement
    ).not.toHaveClass("flex-col")
  })

  it("scrolls artwork and rows together in one mobile content column", async () => {
    const view = renderBrowser()

    const contentColumn = screen.getByRole("banner").nextElementSibling
    expect(contentColumn).toHaveClass(
      "flex-col",
      "overflow-y-auto",
      "md:grid",
      "md:overflow-visible"
    )
    const listColumn = contentColumn?.lastElementChild
    expect(listColumn).toHaveClass("md:overflow-y-auto")
    expect(listColumn).not.toHaveClass("overflow-y-auto")
    const artworkFrame = view.container.querySelector(
      ".save-list-group-artwork-frame"
    )
    expect(artworkFrame?.parentElement).toHaveClass("max-w-72", "md:max-w-none")
    const artworkCredit = await screen.findByText("Artwork: Sample (2004)")
    expect(artworkCredit).not.toHaveClass("hidden", "md:block")
  })

  it("shows episode names by default and keeps filenames opt-in", async () => {
    const view = renderBrowser()

    const groupHeading = screen.getByRole("heading", {
      level: 1,
      name: "Sample Series Sample Arc S04",
    })
    expect(groupHeading).toBeInTheDocument()
    expect(groupHeading).toHaveClass("hidden", "md:block")
    expect(screen.getByRole("banner")).toHaveClass(
      "grid-cols-[4rem_minmax(0,1fr)_4rem]",
      "md:grid-cols-[18rem_minmax(0,1fr)_auto_4rem]",
      "lg:grid-cols-[22rem_minmax(0,1fr)_auto_4rem]"
    )
    expect(screen.getAllByRole("button", { name: "Back" })).not.toHaveLength(0)
    await screen.findByText("1. The Sample Battle")
    expect(screen.queryByText(episodeFilename)).not.toBeInTheDocument()
    await waitFor(() => {
      const episodeImage = view.container.querySelector(
        'img[src*="episode-still-1.jpg"]'
      )
      expect(episodeImage).toBeInTheDocument()
      const stillSlot = episodeImage?.closest('span[class="block shrink-0"]')
      expect(stillSlot).toBeInTheDocument()
      expect(stillSlot).not.toHaveClass("hidden")
    })
    expect(
      screen.getByRole("button", { name: "1. The Sample Battle" }).parentElement
    ).toHaveClass("relative", "flex-col", "md:flex-row")
    const rowMenus = screen.getAllByRole("button", {
      name: `Open menu for ${episodeFilename}`,
    })
    expect(rowMenus).toHaveLength(2)
    expect(rowMenus[0]?.parentElement).toHaveClass("md:hidden")
    expect(rowMenus[1]?.parentElement).toHaveClass("hidden", "md:flex")
    const episodeNamesSwitch = screen.getByRole("switch", {
      name: "Episode names",
    })
    expect(episodeNamesSwitch).toBeInTheDocument()
    expect(episodeNamesSwitch).toHaveAttribute("aria-checked", "true")
    expect(screen.getByText("Episode names")).toHaveClass(
      "text-base",
      "text-foreground"
    )
    expect(screen.getByText("Episode names")).not.toHaveClass(
      "text-muted-foreground"
    )
  })

  it("lets users switch hybrid rows to filenames", async () => {
    renderBrowser()

    const episodeNamesSwitch = screen.getByRole("switch", {
      name: "Episode names",
    })
    fireEvent.click(episodeNamesSwitch)

    expect(episodeNamesSwitch).toHaveAttribute("aria-checked", "false")
    await screen.findByText(episodeFilename)
    expect(screen.queryByText("1. The Sample Battle")).not.toBeInTheDocument()
  })

  it("sorts hybrid episode rows by their numeric episode number", async () => {
    const view = renderBrowser([
      createEpisodeItem(
        "sample-episode-9",
        episodeFilename.replace("S04E01", "S04E09")
      ),
      createEpisodeItem("sample-episode-1", episodeFilename),
      createEpisodeItem(
        "sample-episode-2",
        episodeFilename.replace("S04E01", "S04E02")
      ),
    ])
    await waitFor(() => {
      const episodeRowLabels = [
        ...view.container.querySelectorAll("button[aria-label]"),
      ]
        .map((button) => button.getAttribute("aria-label"))
        .filter(
          (label): label is string =>
            label?.includes("Episode") === true ||
            label === "1. The Sample Battle"
        )

      expect(episodeRowLabels).toEqual([
        "1. The Sample Battle",
        "2. Episode 2",
        "9. Episode 9",
      ])
    })
  })

  it("removes every group item after a delete-all confirmation", async () => {
    const { actions, onExit } = renderBrowser(
      [
        createEpisodeItem("sample-episode-1", episodeFilename),
        createEpisodeItem(
          "sample-episode-2",
          episodeFilename.replace("S04E01", "S04E02")
        ),
      ],
      { actions: createActions(), onExit: vi.fn() }
    )

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open menu for Sample Series Sample Arc S04",
      })
    )
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeVisible()
    })
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete all" }))

    const confirmDialog = await screen.findByRole("alertdialog")
    expect(confirmDialog).toHaveTextContent("Remove 2 items from your list?")
    fireEvent.click(
      within(confirmDialog).getByRole("button", { name: "Delete all" })
    )

    expect(actions.remove).toHaveBeenCalledTimes(2)
    expect(actions.remove).toHaveBeenCalledWith(
      "https://media.example/sample-episode-1",
      "sample-episode-1"
    )
    expect(actions.remove).toHaveBeenCalledWith(
      "https://media.example/sample-episode-2",
      "sample-episode-2"
    )
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})

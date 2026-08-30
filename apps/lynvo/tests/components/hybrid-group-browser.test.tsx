import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HybridGroupBrowser } from "~/components/save-list/hybrid-group-browser"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import type { LinkListItem } from "~/features/links/types"

interface MediaArtworkBatchRequest {
  readonly requests: readonly MediaArtworkRequest[]
}

const episodeFilename =
  "Bleach.Thousand-Year.Blood.War.S04E01.GOD.OF.THUNDER.1080p.mkv"
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
        ? { posterPath: "/season-poster.jpg" }
        : {
            stillPath: `/episode-still-${request.episodeNumber}.jpg`,
            episodeTitle:
              request.episodeNumber === 1
                ? "The Blood Warfare"
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
  itemId = "bleach-episode-1",
  filename = episodeFilename
): LinkListItem => ({
  kind: "saved",
  id: itemId,
  url: `https://media.example/${itemId}`,
  timestamp: Date.now(),
  title: filename,
  metadata: {
    schemaVersion: 3,
    source: { sourceName: "Bilive" },
    extraction: {
      extractedLinks: [
        {
          id: "bleach-episode-1-link",
          url: "https://media.example/bleach-episode-1.mkv",
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
  items: readonly LinkListItem[] = [createEpisodeItem()]
) =>
  render(
    <HybridGroupBrowser
      group={{
        key: "tv:bleach thousand year blood war::S04",
        displayTitle: "Bleach Thousand Year Blood War S04",
        artworkRequest: {
          mediaKind: "tv",
          title: "Bleach Thousand Year Blood War",
          seasonNumber: 4,
        },
        lastAddedAt: Date.now(),
        items,
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
  it("shows episode names by default and keeps filenames opt-in", async () => {
    const view = renderBrowser()

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Bleach Thousand Year Blood War S04",
      })
    ).toBeInTheDocument()
    expect(screen.getByRole("banner")).toHaveClass(
      "md:grid-cols-[18rem_minmax(0,1fr)_auto]",
      "lg:grid-cols-[22rem_minmax(0,1fr)_auto]"
    )
    expect(screen.getAllByRole("button", { name: "Back" })).not.toHaveLength(0)
    await screen.findByText("1. The Blood Warfare")
    expect(screen.queryByText(episodeFilename)).not.toBeInTheDocument()
    await waitFor(() => {
      const episodeImage = view.container.querySelector(
        'img[src*="episode-still-1.jpg"]'
      )
      expect(episodeImage).toBeInTheDocument()
      expect(episodeImage?.closest(".hidden")).toHaveClass("md:block")
    })
    expect(view.container.querySelector(".md\\:hidden")).toBeInTheDocument()
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
    expect(screen.queryByText("1. The Blood Warfare")).not.toBeInTheDocument()
  })

  it("sorts hybrid episode rows by their numeric episode number", async () => {
    const view = renderBrowser([
      createEpisodeItem(
        "bleach-episode-9",
        episodeFilename.replace("S04E01", "S04E09")
      ),
      createEpisodeItem("bleach-episode-1", episodeFilename),
      createEpisodeItem(
        "bleach-episode-2",
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
            label === "1. The Blood Warfare"
        )

      expect(episodeRowLabels).toEqual([
        "1. The Blood Warfare",
        "2. Episode 2",
        "9. Episode 9",
      ])
    })
  })
})

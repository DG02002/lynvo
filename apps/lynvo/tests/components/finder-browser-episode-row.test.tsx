import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SaveListBrowser } from "~/components/save-list/save-list-browser"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import type { LinkViewItem } from "~/features/links/types"

interface MediaArtworkBatchRequest {
  readonly requests: readonly MediaArtworkRequest[]
}

const episodeFilename = "Can.This.Love.Be.Translated.S01E01.1080p.NF.WEB-DL.mkv"
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
  id: "can-this-love-be-translated",
  url: "https://media.example/can-this-love-be-translated",
  timestamp: Date.now(),
  title: "Can This Love Be Translated",
  metadata: {
    schemaVersion: 3,
    source: { sourceName: "Netflix" },
    extraction: {
      extractedLinks: [
        {
          id: "can-this-love-be-translated-episode-1",
          url: "https://media.example/can-this-love-be-translated-episode-1",
          label: episodeFilename,
          type: "file",
          size: "1.05 GB",
        },
      ],
    },
    playback: { openedUrls: [] },
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

    await screen.findByText("1. Episode 1")
    const sourceName = screen.getByText("Netflix")
    const fileSize = screen.getByText("1.05 GB")
    expect(sourceName.parentElement).toContainElement(fileSize)
    expect(sourceName.parentElement).toHaveTextContent("Netflix·1.05 GB")
    expect(screen.getAllByText("1.05 GB")).toHaveLength(1)
    await waitFor(() => {
      const episodeImage = view.container.querySelector(
        'img[src*="episode-1.jpg"]'
      )
      expect(episodeImage?.closest(".hidden")).toHaveClass("md:block")
    })
  })
})

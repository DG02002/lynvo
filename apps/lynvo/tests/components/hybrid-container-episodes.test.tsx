import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SaveListBrowser } from "~/components/save-list/save-list-browser"
import { getHybridCardGroups } from "~/features/links/media-artwork/hybrid-card-grouping"
import type { LinkListItem } from "~/features/links/types"

const item: LinkListItem = {
  kind: "saved",
  id: "vox-repro",
  url: "https://example.com/vox",
  timestamp: 1,
  title: "The Legend of Vox Machina (2022)",
  metadata: {
    schemaVersion: 3,
    source: {},
    playback: { openedUrls: [] },
    extraction: {
      extractedLinks: [
        {
          nodeKey: "quality",
          label: "AVC 1080p WEB-DL H264",
          type: "folder",
          mediaNodeKind: "group",
          children: [
            {
              nodeKey: "episode",
              url: "https://example.com/episode",
              type: "folder",
              mediaNodeKind: "resolvable",
              label:
                "Legend.of.Vox.Machina.S04E01.One.Year.Later.1080p.AMZN.WEB-DL.Hindi.DDP5.1-English.DDP5.1.H.264-4kHdHub.Com.mkv",
            },
          ],
        },
      ],
    },
  },
}

describe("Hybrid episode containers", () => {
  afterEach(() => vi.unstubAllGlobals())
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        // SAFETY: requests are serialized by the real artwork client.
        const body = JSON.parse(String(init?.body)) as {
          requests: MediaArtworkRequest[]
        }
        return new Response(
          JSON.stringify({
            results: body.requests.map((request) => ({
              stillPath: request.episodeNumber ? "/episode.jpg" : undefined,
              posterPath: "/poster.jpg",
              episodeTitle: request.episodeNumber
                ? "Provider Episode Title"
                : undefined,
              identity: {
                providerId: 135934,
                title: "The Legend of Vox Machina",
                year: 2022,
              },
            })),
          }),
          { headers: { "Content-Type": "application/json" } }
        )
      })
    )
    const values = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    })
  })
  it("retains the saved show name and year when episode filenames omit the article", () => {
    expect(getHybridCardGroups([item])[0]?.displayTitle).toBe(
      "The Legend of Vox Machina (2022) S04"
    )
  })
  it("uses episode metadata and mobile still layout for unresolved episodes", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    })
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    })
    render(
      <SaveListBrowser
        items={[item]}
        selectedItemUrl={item.url}
        onSelectedItemUrlChange={vi.fn()}
        actions={{
          play: vi.fn(),
          remove: vi.fn(),
          showLinks: vi.fn(),
          markOpened: vi.fn(),
          expandFolder: vi.fn(),
          softRefresh: vi.fn(),
          hardRefresh: vi.fn(),
          expandMirror: vi.fn(),
        }}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
        shouldShowRowPosters
      />
    )
    expect(screen.getByText("1. One Year Later")).toBeInTheDocument()
    const image = await waitFor(() => {
      const still = document.querySelector('img[src*="episode.jpg"]')
      expect(still).toBeTruthy()
      return still
    })
    expect(screen.getByText("1. Provider Episode Title")).toBeInTheDocument()
    expect(image).toBeTruthy()
    expect(image?.closest(".hidden")).toBeNull()
    fireEvent.click(screen.getByRole("switch"))
    expect(
      screen.getByText(
        item.metadata.extraction.extractedLinks[0]!.children![0]!.label
      )
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("switch"))
    expect(screen.getByText("1. Provider Episode Title")).toBeInTheDocument()
  })
})

import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HybridSaveGrid } from "~/components/save-list/hybrid-save-grid"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import type { LinkListItem } from "~/features/links/types"

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

const createQueuedItem = (
  extractionStatus?: LinkListItem["extractionStatus"]
): LinkListItem => ({
  kind: "saved",
  id: "queued-item",
  url: "https://media.example/queued-item",
  timestamp: Date.now(),
  title: "Queued item",
  metadata: {
    schemaVersion: 3,
    source: {
      pluginName: "Example Source",
      pluginServerId: "ui-test-plugin-server",
    },
    extraction: { extractedLinks: [] },
    playback: { openedUrls: [] },
  },
  extractionStatus,
})

beforeEach(() => {
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
  vi.useRealTimers()
})

const renderQueuedGrid = (item: LinkListItem) =>
  render(
    <HybridSaveGrid
      groups={[
        {
          key: "item:queued-item",
          displayTitle: "Queued item",
          artworkRequest: undefined,
          lastAddedAt: Date.now(),
          items: [item],
        },
      ]}
      actions={createActions()}
      extractingItems={new Set()}
      isHydrating={false}
      highlightedId={null}
      onOpenItem={vi.fn()}
      onOpenGroup={vi.fn()}
    />
  )

describe("HybridSaveGrid", () => {
  it("renders a queued card with a centered spinner and shimmering title only", () => {
    renderQueuedGrid(createQueuedItem({ state: "queued" }))

    const queuedCard = screen.getByTestId("hybrid-save-card")
    expect(queuedCard).toHaveAttribute("data-extraction-state", "queued")

    const posterSpinner = queuedCard.querySelector('[data-slot="spinner"]')
    expect(posterSpinner).toBeInTheDocument()
    expect(posterSpinner?.closest(".aspect-2\\/3")).toBeInTheDocument()

    const queuedTitle = screen.getByText("Waiting to load…")
    expect(queuedTitle).toHaveClass("shimmer")
    expect(queuedTitle.parentElement).toHaveClass(
      "animate-in",
      "fade-in",
      "duration-500"
    )
    expect(queuedTitle.parentElement?.parentElement).toHaveClass(
      "font-heading",
      "text-base",
      "font-normal"
    )
    expect(queuedCard.className).not.toContain("shimmer")
  })

  it("closes the loading state and animates the real title in when extraction ends", () => {
    const view = renderQueuedGrid(createQueuedItem({ state: "running" }))

    view.rerender(
      <HybridSaveGrid
        groups={[
          {
            key: "item:queued-item",
            displayTitle: "Queued item",
            artworkRequest: undefined,
            lastAddedAt: Date.now(),
            items: [createQueuedItem(undefined)],
          },
        ]}
        actions={createActions()}
        extractingItems={new Set()}
        isHydrating={false}
        highlightedId={null}
        onOpenItem={vi.fn()}
        onOpenGroup={vi.fn()}
      />
    )

    const settledCard = screen.getByTestId("hybrid-save-card")
    expect(
      settledCard.querySelector('[data-slot="spinner"]')
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Waiting to load…")).not.toBeInTheDocument()

    const settledHeading = screen.getByRole("heading", { name: "Queued item" })
    expect(settledHeading).toBeVisible()
    expect(settledHeading.parentElement).toHaveClass(
      "animate-in",
      "fade-in",
      "slide-in-from-bottom-1"
    )
  })

  it("opens the group page for a single movie and uses mobile card polish", () => {
    const onOpenGroup = vi.fn()
    const movieItem: LinkListItem = {
      kind: "saved",
      id: "movie-item",
      url: "https://media.example/movie",
      timestamp: Date.now(),
      title: "Ghost in the Shell",
      metadata: {
        schemaVersion: 3,
        source: {
          pluginName: "Example Source",
          pluginServerId: "ui-test-plugin-server",
        },
        extraction: {
          extractedLinks: [
            {
              id: "movie-file",
              url: "https://media.example/movie/file.mkv",
              label: "Ghost.in.the.Shell.2017.mkv",
              type: "file",
            },
          ],
        },
        playback: { openedUrls: [] },
      },
    }

    render(
      <HybridSaveGrid
        groups={[
          {
            key: "movie:ghost in the shell:2017",
            displayTitle: "Ghost in the Shell (2017)",
            artworkRequest: undefined,
            lastAddedAt: Date.now(),
            items: [movieItem],
          },
        ]}
        actions={createActions()}
        extractingItems={new Set()}
        isHydrating={false}
        highlightedId={null}
        onOpenItem={vi.fn()}
        onOpenGroup={onOpenGroup}
      />
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Open Ghost in the Shell (2017)" })
    )
    expect(onOpenGroup).toHaveBeenCalledWith("movie:ghost in the shell:2017")

    const movieCard = screen.getByTestId("hybrid-save-card")
    expect(movieCard.querySelector(".aspect-2\\/3")).toHaveClass(
      "rounded-2xl",
      "sm:rounded-3xl"
    )
    expect(movieCard.querySelector('[class*="bottom-4"]')).toHaveClass(
      "hidden",
      "sm:block"
    )
    expect(movieCard.closest(".grid")).toHaveClass(
      "grid-cols-2",
      "sm:grid-cols-3",
      "md:grid-cols-6"
    )
  })

  it("shows a poster loading spinner while artwork is being looked up", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      // SAFETY: never-settling promise mimics an in-flight lookup; the assertion-free mock needs no Response body
      () => new Promise(() => {}) as Promise<Response>
    )

    render(
      <HybridSaveGrid
        groups={[
          {
            key: "movie:ghost in the shell:2017",
            displayTitle: "Ghost in the Shell (2017)",
            artworkRequest: {
              mediaKind: "movie",
              title: "Ghost in the Shell",
              year: 2017,
            },
            lastAddedAt: Date.now(),
            items: [createQueuedItem(undefined)],
          },
        ]}
        actions={createActions()}
        extractingItems={new Set()}
        isHydrating={false}
        highlightedId={null}
        onOpenItem={vi.fn()}
        onOpenGroup={vi.fn()}
      />
    )

    const movieCard = screen.getByTestId("hybrid-save-card")
    expect(screen.queryByText("No poster found")).not.toBeInTheDocument()
    expect(movieCard.querySelector('[data-slot="spinner"]')).toBeInTheDocument()

    vi.restoreAllMocks()
  })
})

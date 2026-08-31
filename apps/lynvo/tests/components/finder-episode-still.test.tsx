import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FinderEpisodeStill } from "~/components/save-list/finder-episode-still"

describe("FinderEpisodeStill", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ results: [{ stillPath: "/still.jpg" }] }), {
        headers: { "Content-Type": "application/json" },
      })
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("uses the wide-card source for landscape episode stills", async () => {
    const { container } = render(
      <FinderEpisodeStill
        label="Warden.S03E01.Episode.2160p.mkv"
        fallbackIcon={<span>Fallback</span>}
      />
    )

    await waitFor(() => {
      const fullImage = container.querySelector('img:not([aria-hidden="true"])')
      expect(fullImage).toHaveAttribute(
        "src",
        "https://image.tmdb.org/t/p/w780/still.jpg"
      )
    })
  })

  it("requests still-sized sources for retina screens", async () => {
    const { container } = render(
      <FinderEpisodeStill
        label="Warden.S03E01.Episode.2160p.mkv"
        fallbackIcon={<span>Fallback</span>}
      />
    )

    await waitFor(() => {
      const fullImage = container.querySelector('img:not([aria-hidden="true"])')
      expect(fullImage).toHaveAttribute(
        "srcSet",
        "https://image.tmdb.org/t/p/w300/still.jpg 300w, https://image.tmdb.org/t/p/w780/still.jpg 780w, https://image.tmdb.org/t/p/w1280/still.jpg 1280w"
      )
      expect(fullImage).toHaveAttribute(
        "sizes",
        "(min-width: 1024px) 24rem, (min-width: 768px) 16rem, calc(100vw - 1.5rem)"
      )
    })
  })

  it("shows a skeleton while the lookup is pending instead of the fallback icon", () => {
    const { container } = render(
      <FinderEpisodeStill
        label="Warden.S03E01.Episode.2160p.mkv"
        fallbackIcon={<span>Fallback</span>}
      />
    )

    expect(screen.queryByText("Fallback")).not.toBeInTheDocument()
    expect(
      container.querySelector('[data-slot="skeleton"]')
    ).toBeInTheDocument()
  })

  it("renders watched episode stills in grayscale", async () => {
    const { container } = render(
      <FinderEpisodeStill
        label="Warden.S03E01.Episode.2160p.mkv"
        fallbackIcon={<span>Fallback</span>}
        isWatched
      />
    )

    await waitFor(() => {
      expect(container.querySelector("img")).toBeInTheDocument()
    })
    const stillFrame = container.querySelector(".aspect-video")
    expect(stillFrame).toHaveClass("grayscale")
  })
})

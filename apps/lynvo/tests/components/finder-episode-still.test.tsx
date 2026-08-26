import { render, waitFor } from "@testing-library/react"
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
        label="Reacher.S03E01.Persuader.2160p.mkv"
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
})

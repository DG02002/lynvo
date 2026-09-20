import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ChangeArtworkDialog } from "~/components/links/change-artwork-dialog"
import type { LinkViewItem } from "~/features/links/types"

const item: LinkViewItem = {
  url: "https://media.example/movie",
  timestamp: Date.now(),
  title: "Sample Movie",
  metadata: {
    schemaVersion: 3,
    source: {},
    extraction: { extractedLinks: [] },
    playback: { openedUrls: [] },
  },
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("ChangeArtworkDialog", () => {
  it("announces result counts without making the candidate grid a live region", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              candidates: [
                {
                  providerId: 1,
                  title: "Sample Movie",
                  year: 2024,
                  mediaKind: "movie",
                  posterPath: "/poster.jpg",
                },
              ],
            },
          ],
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    )

    render(
      <ChangeArtworkDialog
        item={item}
        open
        onOpenChange={vi.fn()}
        setArtwork={vi.fn()}
      />
    )

    fireEvent.change(screen.getByRole("textbox", { name: "Search title" }), {
      target: { value: "Sample Movie" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Search" }))

    const status = await screen.findByRole("status")
    expect(status).toHaveTextContent("Found 1 artwork result.")
    fireEvent.click(screen.getByRole("tab", { name: /Movies/ }))
    const candidate = await screen.findByRole("button", {
      name: "Sample Movie (2024)",
    })

    expect(status).toBeInTheDocument()
    expect(status).not.toContainElement(candidate)
  })
})

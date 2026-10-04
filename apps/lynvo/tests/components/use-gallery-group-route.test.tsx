import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createElement } from "react"
import { createMemoryRouter, RouterProvider, useLocation } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useGalleryGroupRoute } from "~/components/save-list/use-gallery-group-route"
import type { SavedLinkListItem } from "~/features/links/types"
import { MEDIA_VIEW_STORAGE_KEY } from "~/features/site/settings/media-view-preference"

import { createMemoryStorage } from "../memory-storage"

const savedLink: SavedLinkListItem = {
  kind: "saved",
  id: "sample-movie",
  url: "https://media.example/sample-movie",
  timestamp: 1,
  title: "Sample Movie (2024)",
  metadata: {
    schemaVersion: 3,
    source: {},
    extraction: { extractedLinks: [] },
    playback: { openedUrls: [] },
  },
}

const GalleryGroupRouteProbe = () => {
  const route = useGalleryGroupRoute({
    links: [savedLink],
    isFolderRoute: false,
    isPending: false,
  })
  const location = useLocation()
  const group = route.galleryGroups?.[0]

  return createElement(
    "div",
    null,
    createElement(
      "button",
      {
        type: "button",
        onClick: () => {
          if (group) {
            route.openGroup(group.key, 640)
          }
        },
      },
      "Open group"
    ),
    createElement(
      "button",
      { type: "button", onClick: route.exitGroup },
      "Exit group"
    ),
    createElement("output", { "data-testid": "search" }, location.search),
    createElement(
      "output",
      { "data-testid": "scroll-position" },
      String(location.state?.lynvoSaveListScrollPosition ?? "")
    )
  )
}

describe("gallery group routes", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage())
    localStorage.setItem(MEDIA_VIEW_STORAGE_KEY, "gallery")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("round-trips the Library scroll position through group navigation", async () => {
    const router = createMemoryRouter(
      [
        {
          id: "root",
          path: "/save",
          loader: () => ({ mediaView: "gallery" }),
          element: createElement(GalleryGroupRouteProbe),
        },
      ],
      {
        initialEntries: ["/save"],
        hydrationData: { loaderData: { root: { mediaView: "gallery" } } },
      }
    )

    render(createElement(RouterProvider, { router }))

    fireEvent.click(screen.getByRole("button", { name: "Open group" }))
    await waitFor(() =>
      expect(screen.getByTestId("scroll-position")).toHaveTextContent("640")
    )
    expect(screen.getByTestId("search").textContent).toContain("group=")

    fireEvent.click(screen.getByRole("button", { name: "Exit group" }))
    await waitFor(() =>
      expect(screen.getByTestId("search")).toHaveTextContent("")
    )
    expect(screen.getByTestId("scroll-position")).toHaveTextContent("640")
  })
})

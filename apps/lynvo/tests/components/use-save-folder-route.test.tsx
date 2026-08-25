import { act, renderHook, waitFor } from "@testing-library/react"
import type { PropsWithChildren } from "react"
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router"
import { describe, expect, it } from "vitest"
import { useSaveFolderRoute } from "~/components/save-list/use-save-folder-route"
import type { SavedLinkListItem } from "~/features/links/types"

const savedFolder: SavedLinkListItem = {
  kind: "saved",
  id: "6a7af70a-4fc4-83e8-bd0f-210360e3f50a",
  url: "https://media.example/collection",
  timestamp: 1,
  metadata: {
    schemaVersion: 3,
    source: {},
    extraction: {
      extractedLinks: [
        {
          id: "season-one",
          label: "Season One",
          type: "folder",
          children: [],
        },
      ],
    },
    playback: { openedUrls: [], openedIds: [] },
  },
}

describe("saved folder routes", () => {
  it("opens and closes a saved folder through browser history", async () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <MemoryRouter initialEntries={["/save"]}>
        <Routes>
          <Route path="/save" element={children} />
          <Route path="/save/folder/:savedLinkId" element={children} />
        </Routes>
      </MemoryRouter>
    )
    const { result } = renderHook(
      () => ({
        folder: useSaveFolderRoute([savedFolder], false),
        pathname: useLocation().pathname,
      }),
      { wrapper }
    )

    act(() => result.current.folder.openSavedFolder(savedFolder.url))

    await waitFor(() =>
      expect(result.current.pathname).toBe(
        "/save/folder/6a7af70a-4fc4-83e8-bd0f-210360e3f50a"
      )
    )
    expect(result.current.folder.selectedItemUrl).toBe(savedFolder.url)

    act(() => result.current.folder.closeSavedFolder())

    await waitFor(() => expect(result.current.pathname).toBe("/save"))
    expect(result.current.folder.selectedItemUrl).toBeNull()
  })

  it("does not add a folder entry when the visible Back action closes it", async () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <MemoryRouter initialEntries={["/save"]}>
        <Routes>
          <Route path="/save" element={children} />
          <Route path="/save/folder/:savedLinkId" element={children} />
        </Routes>
      </MemoryRouter>
    )
    const { result } = renderHook(
      () => {
        const navigate = useNavigate()
        return {
          folder: useSaveFolderRoute([savedFolder], false),
          pathname: useLocation().pathname,
          goBack: () => navigate(-1),
        }
      },
      { wrapper }
    )

    act(() => result.current.folder.openSavedFolder(savedFolder.url))
    await waitFor(() =>
      expect(result.current.pathname).toBe(
        "/save/folder/6a7af70a-4fc4-83e8-bd0f-210360e3f50a"
      )
    )

    act(() => result.current.folder.closeSavedFolder())
    await waitFor(() => expect(result.current.pathname).toBe("/save"))

    act(() => result.current.goBack())
    await waitFor(() => expect(result.current.pathname).toBe("/save"))
  })

  it("returns an invalid saved-link ID to the save page after hydration", async () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <MemoryRouter initialEntries={["/save/folder/missing-id"]}>
        <Routes>
          <Route path="/save" element={children} />
          <Route path="/save/folder/:savedLinkId" element={children} />
        </Routes>
      </MemoryRouter>
    )
    const { result } = renderHook(
      () => ({
        folder: useSaveFolderRoute([savedFolder], false),
        pathname: useLocation().pathname,
      }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.pathname).toBe("/save"))
    expect(result.current.folder.selectedItemUrl).toBeNull()
  })

  it("does not redirect away from a saved folder route while items are still loading", async () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <MemoryRouter
        initialEntries={["/save/folder/6a7af70a-4fc4-83e8-bd0f-210360e3f50a"]}
      >
        <Routes>
          <Route path="/save" element={children} />
          <Route path="/save/folder/:savedLinkId" element={children} />
        </Routes>
      </MemoryRouter>
    )
    const { result, rerender } = renderHook(
      ({
        items,
        isPending,
      }: {
        items: SavedLinkListItem[]
        isPending: boolean
      }) => ({
        folder: useSaveFolderRoute(items, isPending),
        pathname: useLocation().pathname,
      }),
      {
        wrapper,
        initialProps: { items: [], isPending: true },
      }
    )

    expect(result.current.pathname).toBe(
      "/save/folder/6a7af70a-4fc4-83e8-bd0f-210360e3f50a"
    )
    expect(result.current.folder.isFolderRoute).toBe(true)
    expect(result.current.folder.selectedItemUrl).toBeNull()

    rerender({ items: [savedFolder], isPending: false })

    expect(result.current.pathname).toBe(
      "/save/folder/6a7af70a-4fc4-83e8-bd0f-210360e3f50a"
    )
    expect(result.current.folder.selectedItemUrl).toBe(savedFolder.url)
  })
})

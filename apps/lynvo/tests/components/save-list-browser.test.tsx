import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { useLocation, useNavigate } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SaveListBrowser } from "~/components/save-list/save-list-browser"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import type { ExtractedLink, LinkViewItem } from "~/features/links/types"
import { withOpenedUrl } from "~/features/links/link-playback-metadata"
import { TEST_PLAYABLE_EXPIRY_AT_MS } from "~/features/links/testing/constants"
import { renderWithMemoryRouter as render } from "../support/render-with-memory-router"

const LocationProbe = () => {
  const location = useLocation()
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  )
}

const BrowserBack = () => {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => void navigate(-1)}>
      Browser back
    </button>
  )
}

const BrowserForward = () => {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => void navigate(1)}>
      Browser forward
    </button>
  )
}

const createActions = (
  overrides: Partial<LinkItemActions> = {}
): LinkItemActions => ({
  play: vi.fn().mockResolvedValue({ accepted: true }),
  remove: vi.fn(),
  showLinks: vi.fn(),
  markOpened: vi.fn(),
  expandFolder: vi.fn(),
  softRefresh: vi.fn(),
  hardRefresh: vi.fn(),
  expandMirror: vi.fn().mockResolvedValue(null),
  ...overrides,
})

describe("SaveListBrowser", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    })
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    })
  })

  it("restores the nested folder in the same tab after refresh", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    })
    const item: LinkViewItem = {
      id: "saved-collection",
      url: "https://media.example/collection",
      timestamp: 1,
      title: "Saved Collection",
      metadata: {
        schemaVersion: 3,
        source: {},
        extraction: {
          extractedLinks: [
            {
              id: "season-one",
              url: "https://media.example/collection/season-one",
              label: "Season One",
              mediaNodeKind: "group",
              type: "folder",
              children: [
                {
                  id: "episode-one",
                  url: "https://media.example/collection/season-one/episode-one.mkv",
                  label: "Episode One",
                  mediaNodeKind: "playable",
                  type: "file",
                },
              ],
            },
          ],
        },
        playback: { openedUrls: [] },
      },
    }
    const onSelectedItemUrlChange = vi.fn()
    window.sessionStorage.setItem(
      "lynvo:save-folder-path:saved-collection",
      JSON.stringify([{ id: "season-one" }])
    )
    const renderSavedFolder = () =>
      render(
        <>
          <SaveListBrowser
            items={[{ ...item, kind: "saved" }]}
            selectedItemUrl={item.url}
            onSelectedItemUrlChange={onSelectedItemUrlChange}
            actions={createActions()}
            extractingItems={new Set()}
            highlightedId={null}
            isHydrating={false}
          />
          <LocationProbe />
          <BrowserBack />
        </>,
        ["/save", "/save/folder/saved-collection?path=season-one"]
      )

    const firstRender = renderSavedFolder()
    expect(
      window.sessionStorage.getItem("lynvo:save-folder-path:saved-collection")
    ).toBeNull()
    const headerMenu = screen.getByRole("button", {
      name: "Open menu for Saved Collection",
    })
    expect(headerMenu).toHaveClass(
      "size-full!",
      "rounded-none!",
      "[&_svg]:size-7!",
      "text-foreground!"
    )
    expect(headerMenu.parentElement).toHaveClass(
      "flex",
      "self-stretch",
      "items-center",
      "justify-center",
      "w-16",
      "text-foreground"
    )
    expect(headerMenu.parentElement).not.toHaveClass("contents")
    expect(headerMenu.parentElement).not.toHaveClass("border-s")
    expect(headerMenu.closest("header")).toHaveClass(
      "grid",
      "grid-cols-[4rem_minmax(0,1fr)_auto_4rem]",
      "md:grid-cols-[18rem_minmax(0,1fr)_auto_4rem]",
      "items-stretch",
      "p-0"
    )
    expect(headerMenu.closest("section")).toHaveClass(
      "save-list-browser-layout"
    )
    expect(headerMenu.closest("header")?.nextElementSibling).toHaveClass(
      "md:grid-cols-[var(--save-list-browser-side-column-width)_minmax(0,1fr)]"
    )
    expect(headerMenu.closest("header")).not.toHaveClass("py-3")
    expect(
      screen.getByRole("heading", { name: "Saved Collection" })
    ).toHaveClass("hidden", "md:block")
    const backButton = screen.getByRole("button", { name: "Back" })
    expect(backButton).toHaveClass("text-lg", "text-foreground")
    expect(backButton.querySelector("svg")).toHaveClass(
      "size-6",
      "text-foreground"
    )
    const seasonFolderButton = screen.getByRole("button", {
      name: "Season One",
    })
    expect(seasonFolderButton).toHaveAttribute("aria-current", "page")
    expect(seasonFolderButton).toHaveAttribute("data-folder-state", "open")
    fireEvent.click(seasonFolderButton!)
    expect(await screen.findByText("Episode One")).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Browser back" }))
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/save/folder/saved-collection"
      )
    )
    expect(screen.queryByText("Episode One")).not.toBeInTheDocument()

    firstRender.unmount()
    renderSavedFolder()

    expect(screen.getByText("Episode One")).toBeVisible()
    expect(screen.getByRole("button", { name: /^Season One/ })).toHaveAttribute(
      "aria-current",
      "page"
    )

    const contentList = document.querySelector<HTMLElement>(
      ".overscroll-y-contain"
    )
    expect(contentList).toBeInTheDocument()
    expect(contentList).toHaveClass("overflow-x-hidden")
    fireEvent.wheel(contentList!, { deltaX: -48, deltaY: 0 })
    expect(screen.queryByText("Episode One")).not.toBeInTheDocument()
    fireEvent.wheel(contentList!, { deltaX: 48, deltaY: 0 })
    expect(screen.getByText("Episode One")).toBeVisible()
    fireEvent.wheel(contentList!, { deltaX: -48, deltaY: 0 })
    expect(screen.queryByText("Episode One")).not.toBeInTheDocument()
    fireEvent.wheel(contentList!, { deltaX: 0, deltaY: 1 })
    fireEvent.wheel(contentList!, { deltaX: -48, deltaY: 0 })
    expect(onSelectedItemUrlChange).toHaveBeenCalledWith(null)
    expect(
      window.sessionStorage.getItem("lynvo:save-folder-path:saved-collection")
    ).toBeNull()
    expect(
      window.sessionStorage.getItem("lynvo:save-folder-scroll:saved-collection")
    ).not.toBeNull()
  })

  it("pushes folder paths and climbs them with browser back and Escape", async () => {
    const item: LinkViewItem = {
      id: "nested-navigation",
      url: "https://media.example/nested-navigation",
      timestamp: 1,
      title: "Nested Navigation",
      metadata: {
        schemaVersion: 3,
        source: {},
        extraction: {
          extractedLinks: [
            {
              id: "folder-one",
              url: "https://media.example/nested-navigation/folder-one",
              label: "Folder One",
              mediaNodeKind: "group",
              type: "folder",
              children: [
                {
                  id: "folder-two",
                  url: "https://media.example/nested-navigation/folder-two",
                  label: "Folder Two",
                  mediaNodeKind: "group",
                  type: "folder",
                  children: [
                    {
                      id: "nested-episode",
                      url: "https://media.example/nested-navigation/episode",
                      label: "Nested Episode",
                      mediaNodeKind: "playable",
                      type: "file",
                    },
                  ],
                },
              ],
            },
            {
              id: "root-episode",
              url: "https://media.example/nested-navigation/root-episode",
              label: "Root Episode",
              mediaNodeKind: "playable",
              type: "file",
            },
          ],
        },
        playback: { openedUrls: [] },
      },
    }
    const scrollTo = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
    })

    render(
      <>
        <SaveListBrowser
          items={[{ ...item, kind: "saved" }]}
          selectedItemUrl={item.url}
          onSelectedItemUrlChange={vi.fn()}
          actions={createActions()}
          extractingItems={new Set()}
          highlightedId={null}
          isHydrating={false}
        />
        <LocationProbe />
        <BrowserBack />
        <BrowserForward />
      </>,
      "/save/folder/nested-navigation"
    )

    fireEvent.click(
      screen.getAllByRole("button", { name: "Folder One" }).at(-1)!
    )
    await screen.findAllByRole("button", { name: "Folder Two" })
    expect(
      screen
        .getAllByRole("button", { name: "Folder One" })
        .some((button) => button.getAttribute("aria-current") === "page")
    ).toBe(true)
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/save/folder/nested-navigation?path=folder-one"
    )

    fireEvent.click(
      screen.getAllByRole("button", { name: "Folder Two" }).at(-1)!
    )
    await screen.findByRole("button", { name: "Nested Episode" })
    expect(
      screen
        .getAllByRole("button", { name: "Folder Two" })
        .some((button) => button.getAttribute("aria-current") === "page")
    ).toBe(true)
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/save/folder/nested-navigation?path=folder-one/folder-two"
    )

    const contentList = document.querySelector<HTMLElement>(
      ".overscroll-y-contain"
    )
    expect(contentList).toBeInTheDocument()
    Object.defineProperty(contentList!, "scrollTop", {
      configurable: true,
      value: 128,
    })

    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    await screen.findAllByRole("button", { name: "Folder Two" })
    expect(
      screen
        .getAllByRole("button", { name: "Folder One" })
        .some((button) => button.getAttribute("aria-current") === "page")
    ).toBe(true)
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/save/folder/nested-navigation?path=folder-one"
    )

    fireEvent.click(screen.getByRole("button", { name: "Browser forward" }))
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/save/folder/nested-navigation?path=folder-one/folder-two"
      )
    )
    await screen.findByRole("button", { name: "Nested Episode" })
    expect(scrollTo).toHaveBeenCalledWith({ top: 128 })

    fireEvent.click(screen.getByRole("button", { name: "Browser back" }))
    await screen.findAllByRole("button", { name: "Folder Two" })
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/save/folder/nested-navigation?path=folder-one"
    )

    fireEvent.click(screen.getByRole("button", { name: "Browser back" }))
    await screen.findByRole("button", { name: "Root Episode" })
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/save/folder/nested-navigation"
    )

    fireEvent.click(
      screen.getAllByRole("button", { name: "Folder One" }).at(-1)!
    )
    await screen.findAllByRole("button", { name: "Folder Two" })
    fireEvent.click(
      screen.getAllByRole("button", { name: "Folder Two" }).at(-1)!
    )
    await screen.findByRole("button", { name: "Nested Episode" })

    fireEvent.keyDown(window, { key: "Escape" })
    await screen.findAllByRole("button", { name: "Folder Two" })
    expect(
      screen
        .getAllByRole("button", { name: "Folder One" })
        .some((button) => button.getAttribute("aria-current") === "page")
    ).toBe(true)
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/save/folder/nested-navigation?path=folder-one"
    )
  })

  it("does not turn back between saved folder routes into a folder climb", async () => {
    const item: LinkViewItem = {
      id: "folder-route-transition",
      url: "https://media.example/folder-route-transition",
      timestamp: 1,
      title: "Folder Route Transition",
      metadata: {
        schemaVersion: 3,
        source: {},
        extraction: {
          extractedLinks: [
            {
              id: "nested-folder",
              url: "https://media.example/folder-route-transition/nested",
              label: "Nested Folder",
              mediaNodeKind: "group",
              type: "folder",
              children: [
                {
                  id: "nested-file",
                  url: "https://media.example/folder-route-transition/nested/file",
                  label: "Nested File",
                  mediaNodeKind: "playable",
                  type: "file",
                },
              ],
            },
          ],
        },
        playback: { openedUrls: [] },
      },
    }

    render(
      <>
        <SaveListBrowser
          items={[{ ...item, kind: "saved" }]}
          selectedItemUrl={item.url}
          onSelectedItemUrlChange={vi.fn()}
          actions={createActions()}
          extractingItems={new Set()}
          highlightedId={null}
          isHydrating={false}
        />
        <LocationProbe />
        <BrowserBack />
      </>,
      [
        "/save/folder/previous-folder",
        "/save/folder/folder-route-transition?path=nested-folder",
      ]
    )

    fireEvent.click(screen.getByRole("button", { name: "Browser back" }))
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/save/folder/previous-folder"
      )
    )
  })

  it("normalizes an unknown deep-link segment to the deepest valid folder", async () => {
    const item: LinkViewItem = {
      id: "stale-navigation",
      url: "https://media.example/stale-navigation",
      timestamp: 1,
      title: "Stale Navigation",
      metadata: {
        schemaVersion: 3,
        source: {},
        extraction: {
          extractedLinks: [
            {
              id: "folder-one",
              url: "https://media.example/stale-navigation/folder-one",
              label: "Folder One",
              mediaNodeKind: "group",
              type: "folder",
              children: [
                {
                  id: "folder-two",
                  url: "https://media.example/stale-navigation/folder-two",
                  label: "Folder Two",
                  mediaNodeKind: "group",
                  type: "folder",
                  children: [],
                },
              ],
            },
            {
              id: "root-episode",
              url: "https://media.example/stale-navigation/root-episode",
              label: "Root Episode",
              mediaNodeKind: "playable",
              type: "file",
            },
          ],
        },
        playback: { openedUrls: [] },
      },
    }

    render(
      <>
        <SaveListBrowser
          items={[{ ...item, kind: "saved" }]}
          selectedItemUrl={item.url}
          onSelectedItemUrlChange={vi.fn()}
          actions={createActions()}
          extractingItems={new Set()}
          highlightedId={null}
          isHydrating={false}
        />
        <LocationProbe />
      </>,
      "/save/folder/stale-navigation?path=folder-one/unknown-folder"
    )

    await screen.findAllByRole("button", { name: "Folder Two" })
    expect(
      screen
        .getAllByRole("button", { name: "Folder One" })
        .some((button) => button.getAttribute("aria-current") === "page")
    ).toBe(true)
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/save/folder/stale-navigation?path=folder-one"
      )
    )
    expect(
      screen.getAllByRole("button", { name: "Folder Two" })
    ).not.toHaveLength(0)
  })

  it("renders protocol group folders without url targets and marks them opened by id", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    })
    const markOpened = vi.fn()
    const item: LinkViewItem = {
      id: "plugin-series-item",
      url: "https://source.example/plugin-series",
      timestamp: 1,
      title: "Plugin Series",
      metadata: {
        schemaVersion: 3,
        source: {},
        extraction: {
          extractedLinks: [
            {
              nodeKey: "0:group:folder-S01",
              id: "folder-S01",
              label: "Season 1",
              type: "folder",
              mediaNodeKind: "group",
              selectable: false,
              children: [
                {
                  nodeKey: "0.0:resolvable:episode-one",
                  id: "episode-one",
                  nodeUrl: "https://files.example/drive/episode-one",
                  label: "Episode One",
                  type: "folder",
                  mediaNodeKind: "resolvable",
                  resolutionKind: "mirrors",
                },
              ],
            },
            {
              nodeKey: "1:group:identifier-less",
              label: "Identifier-less Group",
              type: "folder",
              mediaNodeKind: "group",
              selectable: false,
              children: [],
            },
          ],
        },
        playback: { openedUrls: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={item.url}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions({ markOpened })}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    expect(
      screen.getAllByRole("button", { name: /^Season 1/ }).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByRole("button", { name: /Identifier-less Group/ }).length
    ).toBeGreaterThan(0)

    const contentSeasonButton = screen
      .getAllByRole("button", { name: /^Season 1/ })
      .at(-1)!
    fireEvent.click(contentSeasonButton)

    expect(await screen.findByText("Episode One")).toBeVisible()
    await waitFor(() =>
      expect(markOpened).toHaveBeenCalledWith(item.url, "folder-S01")
    )
  })

  it("renders a target-less mirror resolvable root without crashing the list", () => {
    const item: LinkViewItem = {
      id: "target-less-resolvable-item",
      url: "https://source.example/target-less-resolvable",
      timestamp: 1,
      title: "Target-less Resolvable",
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Source Gamma" },
        extraction: {
          extractedLinks: [
            {
              nodeKey: "0:resolvable:target-less",
              label: "Target-less Container",
              type: "folder",
              mediaNodeKind: "resolvable",
              resolutionKind: "mirrors",
            },
          ],
        },
        playback: { openedUrls: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={null}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions()}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    expect(screen.getByText("Target-less Container")).toBeVisible()
    expect(screen.getByText("Source Gamma")).toBeVisible()
  })

  it("registers navigation wheel events as non-passive", () => {
    const item: LinkViewItem = {
      id: "wheel-listener-item",
      url: "https://media.example/wheel-listener",
      timestamp: 1,
      title: "Wheel Listener Item",
      metadata: {
        schemaVersion: 3,
        source: {},
        extraction: {
          extractedLinks: [
            {
              id: "wheel-listener-file",
              url: "https://media.example/wheel-listener/file.mp4",
              label: "File.mp4",
              mediaNodeKind: "playable",
              type: "file",
            },
          ],
        },
        playback: { openedUrls: [] },
      },
    }
    const addEventListenerSpy = vi.spyOn(
      HTMLElement.prototype,
      "addEventListener"
    )

    try {
      render(
        <SaveListBrowser
          items={[{ ...item, kind: "saved" }]}
          selectedItemUrl={item.url}
          onSelectedItemUrlChange={vi.fn()}
          actions={createActions()}
          extractingItems={new Set()}
          highlightedId={null}
          isHydrating={false}
        />
      )

      expect(addEventListenerSpy.mock.calls).toContainEqual([
        "wheel",
        expect.any(Function),
        { passive: false },
      ])
    } finally {
      addEventListenerSpy.mockRestore()
    }
  })

  it("lazily extracts an unresolved folder when it is opened", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    })
    const resolvedLinks: ExtractedLink[] = [
      {
        id: "folder-alpha",
        url: "https://index.example.com/0:/Collections/Folder%20Alpha/",
        label: "Folder Alpha",
        mediaNodeKind: "group",
        type: "folder",
        childrenResolved: true,
        children: [
          {
            id: "playable-item-1",
            url: "https://index.example.com/0:/Collections/Folder%20Alpha/playable-item.mkv",
            label: "playable-item.mkv",
            mediaNodeKind: "playable",
            type: "file",
          },
        ],
      },
    ]
    const expandFolder = vi.fn().mockResolvedValue(resolvedLinks)
    const item: LinkViewItem = {
      url: "https://index.example.com/0:/Collections/",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Source Alpha" },
        extraction: {
          extractedLinks: [
            {
              id: "folder-alpha",
              url: "https://index.example.com/0:/Collections/Folder%20Alpha/",
              label: "Folder Alpha",
              type: "folder",
              mediaNodeKind: "resolvable",
              resolutionKind: "folder",
            },
          ],
        },
        playback: { openedUrls: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={item.url}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions({ expandFolder })}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    const folderButtons = screen.getAllByRole("button", {
      name: /^Folder Alpha/,
    })
    expect(folderButtons).toHaveLength(2)
    expect(
      folderButtons.every(
        (button) =>
          button
            .closest("[data-folder-state]")
            ?.getAttribute("data-folder-state") === "lazy-closed"
      )
    ).toBe(true)
    fireEvent.click(folderButtons.at(-1)!)

    await waitFor(() =>
      expect(expandFolder).toHaveBeenCalledWith(
        item.url,
        "folder-alpha",
        "https://index.example.com/0:/Collections/Folder%20Alpha/"
      )
    )
    expect(await screen.findByText("playable-item.mkv")).toBeVisible()
    expect(
      screen.getByRole("button", { name: /Folder Alpha/ })
    ).toHaveAttribute("data-folder-state", "open")
  })

  it("does not reopen a folder when lazy expansion resolves after browser back", async () => {
    let finishExpansion: ((links: ExtractedLink[]) => void) | undefined
    const resolvedLinks: ExtractedLink[] = [
      {
        id: "resolved-file",
        url: "https://media.example/resolved-file",
        label: "Resolved File",
        mediaNodeKind: "playable",
        type: "file",
      },
    ]
    const expandFolder = vi.fn(
      () =>
        new Promise<ExtractedLink[]>((resolve) => {
          finishExpansion = resolve
        })
    )
    const item: LinkViewItem = {
      id: "lazy-race",
      url: "https://media.example/lazy-race",
      timestamp: 1,
      title: "Lazy Race",
      metadata: {
        schemaVersion: 3,
        source: {},
        extraction: {
          extractedLinks: [
            {
              id: "lazy-folder",
              url: "https://media.example/lazy-folder",
              label: "Lazy Folder",
              mediaNodeKind: "resolvable",
              resolutionKind: "folder",
              type: "folder",
            },
          ],
        },
        playback: { openedUrls: [] },
      },
    }

    render(
      <>
        <SaveListBrowser
          items={[{ ...item, kind: "saved" }]}
          selectedItemUrl={item.url}
          onSelectedItemUrlChange={vi.fn()}
          actions={createActions({ expandFolder })}
          extractingItems={new Set()}
          highlightedId={null}
          isHydrating={false}
        />
        <LocationProbe />
        <BrowserBack />
      </>,
      ["/save", "/save/folder/lazy-race"]
    )

    fireEvent.click(
      screen.getAllByRole("button", { name: "Lazy Folder" }).at(-1)!
    )
    await waitFor(() => expect(expandFolder).toHaveBeenCalled())

    fireEvent.click(screen.getByRole("button", { name: "Browser back" }))
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/save")
    )
    finishExpansion?.(resolvedLinks)

    await waitFor(() =>
      expect(screen.queryByText("Resolved File")).not.toBeInTheDocument()
    )
    expect(screen.getByTestId("location")).toHaveTextContent("/save")
  })

  it("shows a single resolvable container directly on the save page", async () => {
    const onSelectedItemUrlChange = vi.fn()
    const markOpened = vi.fn()
    const expandMirror = vi.fn().mockResolvedValue([
      {
        url: "https://files.example/route-alpha",
        label: "Play from Source Route Alpha",
        mediaNodeKind: "playable",
        type: "file",
        size: "1.2 GB",
      },
    ])
    const item: LinkViewItem = {
      id: "plugin-source-beta-item",
      url: "https://plugin-source-beta.cx/drive/example",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Source Beta" },
        extraction: {
          extractedLinks: [
            {
              id: "plugin-source-beta-container",
              url: "https://plugin-source-beta.cx/drive/example",
              label: "Playable Item Alpha.mkv",
              type: "folder",
              mediaNodeKind: "resolvable",
              size: "8.2 GB",
            },
          ],
        },
        playback: { openedUrls: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={null}
        onSelectedItemUrlChange={onSelectedItemUrlChange}
        actions={createActions({ expandMirror, markOpened })}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Playable Item Alpha.mkv" })
    )

    expect(markOpened).not.toHaveBeenCalled()
    expect(
      await screen.findByText("Play from Source Route Alpha")
    ).toBeVisible()
    const sourceName = screen.getByText("Source Beta")
    expect(sourceName).toBeVisible()
    expect(sourceName.parentElement).toHaveTextContent("Source Beta·8.2 GB")
    expect(screen.queryByText("1.2 GB")).not.toBeInTheDocument()
    expect(onSelectedItemUrlChange).not.toHaveBeenCalled()
    expect(expandMirror).toHaveBeenCalledWith(item.url, item.url, false)

    fireEvent.click(
      screen.getByRole("button", { name: "Play from Source Route Alpha" })
    )
    await waitFor(() =>
      expect(markOpened).toHaveBeenCalledWith(item.url, item.url)
    )
  })

  it("resolves a Resolver Beta playable-item inline with loading and opened feedback", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    })
    let finishResolution: (() => void) | undefined
    const markOpened = vi.fn()
    const expandMirror = vi.fn<LinkItemActions["expandMirror"]>()
    const item: LinkViewItem = {
      id: "resolver-beta-item",
      url: "https://source-alpha.example/collection",
      timestamp: Date.now(),
      title: "Source Alpha collection",
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Source Alpha" },
        extraction: {
          extractedLinks: [
            {
              id: "playable-item-one",
              url: "https://resolver-beta.example/playable-item-one",
              label: "Playable Item One",
              type: "folder",
              mediaNodeKind: "resolvable",
            },
          ],
        },
        playback: { openedUrls: [] },
      },
    }

    const Harness = () => {
      const [extractingItems, setExtractingItems] = useState(new Set<string>())
      const [currentItem, setCurrentItem] = useState({
        ...item,
        kind: "saved" as const,
      })
      expandMirror.mockImplementation(async (_, lazyItemUrl) => {
        if (extractingItems.has(lazyItemUrl)) {
          return null
        }

        setExtractingItems((currentItems) =>
          new Set(currentItems).add(lazyItemUrl)
        )
        await new Promise<void>((resolve) => {
          finishResolution = resolve
        })
        setExtractingItems(new Set())
        return [
          {
            url: `${lazyItemUrl}/route-alpha`,
            label: "Play from Source Route Alpha",
            mediaNodeKind: "playable",
            type: "file",
            size: "1.2 GB",
          },
          {
            url: `${lazyItemUrl}/route-beta`,
            label: "Play from Source Route Beta Server",
            mediaNodeKind: "playable",
            type: "file",
            size: "1.4 GB",
          },
          {
            url: `${lazyItemUrl}/route-gamma`,
            label: "Play from CDN Server (404)",
            mediaNodeKind: "playable",
            type: "file",
            status: "down",
          },
        ]
      })
      const actions = createActions({
        markOpened: (itemUrl, linkUrl) => {
          markOpened(itemUrl, linkUrl)
          setCurrentItem((previousItem) => ({
            ...previousItem,
            metadata: withOpenedUrl(
              previousItem.metadata ?? previousItem.meta,
              linkUrl
            ),
          }))
        },
        expandMirror,
      })

      return (
        <SaveListBrowser
          items={[currentItem]}
          selectedItemUrl={item.url}
          onSelectedItemUrlChange={vi.fn()}
          actions={actions}
          extractingItems={extractingItems}
          highlightedId={null}
          isHydrating={false}
        />
      )
    }

    render(<Harness />)
    const playableItemButton = screen.getByRole("button", {
      name: "Playable Item One",
    })
    fireEvent.click(playableItemButton)

    expect(
      await screen.findByRole("status", {
        name: "Loading playable links for Playable Item One…",
      })
    ).toBeVisible()
    const playableItemRow = playableItemButton.parentElement
    const resolvingSpinner = playableItemRow?.querySelector(
      '[data-slot="spinner"]'
    )
    expect(resolvingSpinner).toBeInTheDocument()
    expect(resolvingSpinner).toHaveClass("size-6")
    expect(resolvingSpinner?.parentElement).toHaveClass("size-10", "md:size-14")
    expect(playableItemRow).toHaveAttribute(
      "data-resolution-state",
      "resolving"
    )
    expect(markOpened).not.toHaveBeenCalled()

    fireEvent.click(playableItemButton)
    fireEvent.click(
      screen.getByRole("button", {
        name: "Open menu for Playable Item One",
      })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: "Refresh" }))

    expect(playableItemRow).toHaveAttribute(
      "data-resolution-state",
      "resolving"
    )
    expect(playableItemButton).not.toHaveClass("bg-destructive/15")
    expect(expandMirror).toHaveBeenCalledTimes(1)

    finishResolution?.()

    await waitFor(() => {
      expect(
        screen.getByText("Play from Source Route Alpha")
      ).toBeInTheDocument()
      expect(
        screen.getByText("Play from Source Route Beta Server")
      ).toBeInTheDocument()
    })
    expect(screen.queryByText("Source Route Alpha")).not.toBeInTheDocument()
    expect(screen.queryByText("Source Route Beta")).not.toBeInTheDocument()
    expect(
      screen.queryByText("Play from CDN Server (404)")
    ).not.toBeInTheDocument()
    expect(markOpened).not.toHaveBeenCalled()
    expect(playableItemButton).not.toHaveClass("bg-destructive/15")
    expect(playableItemButton).not.toHaveClass("bg-sky-500/15")
    expect(playableItemButton).toHaveClass("bg-muted/60")
    expect(playableItemRow).toHaveAttribute("data-resolution-state", "expanded")
    expect(
      screen.getAllByRole("button", {
        name: /Open menu for Play from Source Route/,
      })
    ).toHaveLength(2)
    expect(
      screen
        .getAllByRole("button", {
          name: /Open menu for Play from Source Route/,
        })
        .every((menuButton) =>
          menuButton.classList.contains("text-foreground!")
        )
    ).toBe(true)
    expect(
      screen.getByRole("button", { name: "Open menu for Playable Item One" })
    ).toBeInTheDocument()
    expect(screen.queryByText("1.2 GB")).not.toBeInTheDocument()
    expect(
      playableItemButton.nextElementSibling?.querySelectorAll("svg")
    ).toHaveLength(1)
    expect(screen.queryByText("1.4 GB")).not.toBeInTheDocument()
    const mirrorGroup = screen
      .getByText("Play from Source Route Alpha")
      .closest("[data-container-children]")
    expect(mirrorGroup).toHaveClass("bg-muted/60", "ps-12", "md:ps-14")
    const connectors = mirrorGroup?.querySelectorAll(
      "[data-container-connector]"
    )
    expect(connectors).toHaveLength(3)
    expect(connectors?.[0]).toHaveClass("w-0.5", "bg-sky-500")
    expect(connectors?.[1]).toHaveClass(
      "-start-3",
      "h-0.5",
      "w-3",
      "bg-sky-500"
    )
    expect(
      screen
        .getAllByRole("button", {
          name: /Open menu for Play from Source Route/,
        })
        .every((menuButton) =>
          menuButton
            .closest("[data-container-children]")
            ?.classList.contains("bg-muted/60")
        )
    ).toBe(true)

    fireEvent.click(
      screen.getByRole("button", { name: "Play from Source Route Alpha" })
    )
    await waitFor(() =>
      expect(markOpened).toHaveBeenCalledWith(
        item.url,
        "https://resolver-beta.example/playable-item-one"
      )
    )
    expect(playableItemButton).toHaveClass("bg-sky-500/15")

    fireEvent.click(playableItemButton)
    await waitFor(() => {
      expect(
        screen.queryByText("Play from Source Route Alpha")
      ).not.toBeInTheDocument()
    })
    expect(playableItemRow).toHaveAttribute(
      "data-resolution-state",
      "collapsed"
    )
    fireEvent.click(playableItemButton)
    expect(
      await screen.findByText("Play from Source Route Alpha")
    ).toBeVisible()
  })

  it("preserves cached mirrors when refresh is clicked during an external resolve", async () => {
    const lazyItemUrl = "https://resolver-beta.example/cached-playable-item"
    const item: LinkViewItem = {
      id: "resolver-beta-cached-item",
      url: "https://source-alpha.example/cached-collection",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Source Alpha" },
        extraction: {
          extractedLinks: [
            {
              id: "cached-playable-item",
              url: lazyItemUrl,
              label: "Cached Playable Item",
              type: "folder",
              mediaNodeKind: "resolvable",
            },
          ],
        },
        playback: {
          openedUrls: [],
          resolvedMirrors: {
            [lazyItemUrl]: [
              {
                url: "https://cdn.example/cached-playable-item.mp4",
                label: "Cached Playable Item Mirror",
                mediaNodeKind: "playable",
                type: "file",
              },
            ],
          },
        },
      },
    }
    const expandMirror = vi.fn().mockResolvedValue(null)

    const Harness = () => {
      const [extractingItems, setExtractingItems] = useState(
        () => new Set([lazyItemUrl])
      )

      return (
        <>
          <button type="button" onClick={() => setExtractingItems(new Set())}>
            Finish external resolve
          </button>
          <SaveListBrowser
            items={[{ ...item, kind: "saved" }]}
            selectedItemUrl={item.url}
            onSelectedItemUrlChange={vi.fn()}
            actions={createActions({ expandMirror })}
            extractingItems={extractingItems}
            highlightedId={null}
            isHydrating={false}
          />
        </>
      )
    }

    render(<Harness />)
    const cachedItemButton = screen.getByRole("button", {
      name: "Cached Playable Item",
    })
    const cachedItemRow = cachedItemButton.parentElement
    expect(cachedItemRow).toHaveAttribute("data-resolution-state", "resolving")

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open menu for Cached Playable Item",
      })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: "Refresh" }))
    expect(expandMirror).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole("button", { name: "Finish external resolve" })
    )

    await waitFor(() => {
      expect(cachedItemRow).toHaveAttribute(
        "data-resolution-state",
        "collapsed"
      )
    })
  })

  it("updates cached mirrors from saved link metadata without remounting the row", async () => {
    const lazyItemUrl = "https://resolver-beta.example/metadata-update"
    const createItem = (mirrorLabel: string): LinkViewItem => ({
      id: "resolver-beta-metadata-update",
      url: "https://source-alpha.example/metadata-update",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Source Alpha" },
        extraction: {
          extractedLinks: [
            {
              id: "metadata-update",
              url: lazyItemUrl,
              label: "Metadata Update Item",
              type: "folder",
              mediaNodeKind: "resolvable",
            },
          ],
        },
        playback: {
          openedUrls: [],
          resolvedMirrors: {
            [lazyItemUrl]: [
              {
                url: `https://cdn.example/${mirrorLabel}.mp4`,
                label: mirrorLabel,
                mediaNodeKind: "playable",
                type: "file",
              },
            ],
          },
        },
      },
    })

    const Harness = () => {
      const [item, setItem] = useState(() => createItem("Old cached mirror"))

      return (
        <>
          <button
            type="button"
            onClick={() => setItem(createItem("Fresh cached mirror"))}
          >
            Update saved link metadata
          </button>
          <SaveListBrowser
            items={[{ ...item, kind: "saved" }]}
            selectedItemUrl={item.url}
            onSelectedItemUrlChange={vi.fn()}
            actions={createActions()}
            extractingItems={new Set()}
            highlightedId={null}
            isHydrating={false}
          />
        </>
      )
    }

    render(<Harness />)
    fireEvent.click(
      screen.getByRole("button", { name: "Metadata Update Item" })
    )
    expect(await screen.findByText("Old cached mirror")).toBeVisible()

    fireEvent.click(
      screen.getByRole("button", { name: "Update saved link metadata" })
    )

    expect(await screen.findByText("Fresh cached mirror")).toBeVisible()
    expect(screen.queryByText("Old cached mirror")).not.toBeInTheDocument()
  })

  it("shows a red failure state when a resolvable item returns no links", async () => {
    const markOpened = vi.fn()
    const item: LinkViewItem = {
      url: "https://source-alpha.example/failure",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Source Alpha" },
        extraction: {
          extractedLinks: [
            {
              id: "failed-playable-item",
              url: "https://resolver-beta.example/resolution-failure",
              label: "Playable Item Resolution Failure",
              type: "folder",
              mediaNodeKind: "resolvable",
            },
          ],
        },
        playback: { openedUrls: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={item.url}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions({
          markOpened,
          expandMirror: vi.fn().mockResolvedValue(null),
        })}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    const failedPlayableItemButton = screen.getByRole("button", {
      name: "Playable Item Resolution Failure",
    })
    fireEvent.click(failedPlayableItemButton)

    const failedPlayableItemRow = failedPlayableItemButton.parentElement
    await waitFor(() => {
      expect(failedPlayableItemRow).toHaveAttribute(
        "data-resolution-state",
        "failed"
      )
    })
    expect(failedPlayableItemButton).toHaveClass("bg-destructive/15")
    expect(markOpened).not.toHaveBeenCalled()
  })

  it("shows a failure state when resolving a playable item throws", async () => {
    const item: LinkViewItem = {
      url: "https://source-alpha.example/thrown-resolution",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Source Alpha" },
        extraction: {
          extractedLinks: [
            {
              id: "thrown-resolution-item",
              url: "https://resolver-beta.example/thrown-resolution",
              label: "Thrown Resolution Item",
              type: "folder",
              mediaNodeKind: "resolvable",
            },
          ],
        },
        playback: { openedUrls: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={item.url}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions({
          expandMirror: vi.fn().mockRejectedValue(new Error("network failed")),
        })}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    const itemButton = screen.getByRole("button", {
      name: "Thrown Resolution Item",
    })
    fireEvent.click(itemButton)

    await waitFor(() =>
      expect(itemButton.parentElement).toHaveAttribute(
        "data-resolution-state",
        "failed"
      )
    )
    expect(itemButton).toHaveClass("bg-destructive/15")
  })

  it("shows the size of a single playable Example Drive item", () => {
    const directLink: ExtractedLink = {
      id: "example-drive-file",
      url: "https://drive.example.com/download?id=example-drive-file",
      label: "Surround Sound Helicopter.m2ts",
      type: "file",
      mediaNodeKind: "playable",
      size: "193.65 MB",
    }
    const item: LinkViewItem = {
      url: "https://drive.example.com/file/d/example-drive-file/view",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Example Drive" },
        extraction: { extractedLinks: [directLink] },
        playback: { openedUrls: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={null}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions()}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    const sourceName = screen.getByText("Example Drive")
    const fileSize = screen.getByText("193.65 MB")
    expect(fileSize).toBeVisible()
    expect(sourceName.parentElement).toContainElement(fileSize)
    expect(sourceName.parentElement).toHaveTextContent(
      "Example Drive·193.65 MB"
    )
  })

  it("renders an opened Direct Media root item with the opened background", () => {
    const directLink: ExtractedLink = {
      url: "https://cdn.example.com/video.mp4",
      label: "video.mp4",
      mediaNodeKind: "playable",
      type: "file",
      expiry: TEST_PLAYABLE_EXPIRY_AT_MS,
    }
    const item: LinkViewItem = {
      url: "https://source.example/video",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Direct Media" },
        extraction: { extractedLinks: [directLink] },
        playback: { openedUrls: [directLink.url] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={null}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions()}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    expect(screen.getByRole("button", { name: /video.mp4/ })).toHaveClass(
      "bg-sky-500/15"
    )
    expect(screen.queryByText("4K HDR")).not.toBeInTheDocument()
    expect(screen.queryByText("New")).not.toBeInTheDocument()
    const expiryMetadata = screen.getByText("Link valid until Jan 1, 2030")
    expect(expiryMetadata).toBeInTheDocument()
    expect(expiryMetadata).toHaveAttribute(
      "title",
      "Expiry for this playable link; the saved item itself does not expire."
    )
  })

  it("renders the root item menu as a full-height trailing cell", () => {
    const directLink: ExtractedLink = {
      url: "https://cdn.example.com/cell-menu.mp4",
      label: "cell-menu.mp4",
      mediaNodeKind: "playable",
      type: "file",
    }
    const item: LinkViewItem = {
      url: "https://source.example/cell-menu",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Direct Media" },
        extraction: { extractedLinks: [directLink] },
        playback: { openedUrls: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={null}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions()}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    const menuTrigger = screen.getByRole("button", {
      name: "Open menu for https://source.example/cell-menu",
    })
    expect(menuTrigger).toHaveClass("size-full!", "rounded-none!")
    expect(menuTrigger.parentElement).toHaveClass("w-16", "text-foreground")
    expect(menuTrigger.parentElement).not.toHaveClass("border-s")
  })

  it("disables and mutes an expired playable link", () => {
    const play = vi.fn()
    const directLink: ExtractedLink = {
      url: "https://cdn.example.com/expired-video.mp4",
      label: "expired-video.mp4",
      mediaNodeKind: "playable",
      type: "file",
      expiry: Date.now() - 60_000,
    }
    const item: LinkViewItem = {
      url: "https://source.example/expired-video",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Direct Media" },
        extraction: { extractedLinks: [directLink] },
        playback: { openedUrls: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={null}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions({ play })}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    const filename = screen.getByText("expired-video.mp4")
    const itemButton = screen.getByRole("button", {
      name: "Open expired-video.mp4",
    })
    expect(itemButton).toBeDisabled()
    expect(filename.closest("button")).toBeNull()
    expect(filename.closest("div")).toHaveClass(
      "text-muted-foreground",
      "opacity-60"
    )
    expect(filename).toHaveClass("line-through")
    expect(screen.getByText("Link expired").querySelector("svg")).toBeNull()
    expect(screen.queryByText("New")).not.toBeInTheDocument()
    fireEvent.click(itemButton)
    expect(play).not.toHaveBeenCalled()
  })

  it("disables a playable row when the minute clock reaches its expiry", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-22T10:00:30.000Z"))
    const directLink: ExtractedLink = {
      url: "https://cdn.example.com/expiring-video.mp4",
      label: "expiring-video.mp4",
      mediaNodeKind: "playable",
      type: "file",
      expiry: new Date("2026-07-22T10:01:00.000Z").getTime(),
    }
    const item: LinkViewItem = {
      url: "https://source.example/expiring-video",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Direct Media" },
        extraction: { extractedLinks: [directLink] },
        playback: { openedUrls: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={null}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions()}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    const itemButton = screen.getByRole("button", {
      name: "Open expiring-video.mp4",
    })
    const filename = screen.getByText("expiring-video.mp4")
    expect(itemButton).toBeEnabled()
    expect(filename).not.toHaveClass("line-through")

    act(() => vi.advanceTimersByTime(30_000))

    expect(itemButton).toBeDisabled()
    expect(filename).toHaveClass("line-through")
    vi.useRealTimers()
  })

  it("shows New on a root folder before it is opened and marks it opened on open", () => {
    const markOpened = vi.fn()
    const item: LinkViewItem = {
      url: "https://source.example/folder",
      timestamp: Date.now(),
      metadata: {
        schemaVersion: 3,
        source: { sourceName: "Folder source" },
        extraction: {
          extractedLinks: [
            {
              id: "folder-one",
              url: "https://source.example/folder/one",
              label: "Folder one",
              mediaNodeKind: "resolvable",
              resolutionKind: "folder",
              type: "folder",
              children: [],
            },
          ],
        },
        playback: { openedUrls: [] },
      },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={null}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions({ markOpened })}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    const newBadges = screen.getAllByText("New")
    expect(newBadges).toHaveLength(2)
    expect(newBadges[0]).toHaveClass("md:hidden")
    expect(newBadges[1]).toHaveClass("hidden", "md:inline-flex")
    const itemCounts = screen.getAllByText("1 item")
    expect(itemCounts).toHaveLength(1)
    expect(
      Boolean(
        itemCounts[0].compareDocumentPosition(newBadges[0]) &
        Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true)
    const folderButton = screen.getByRole("button", {
      name: "View source.example",
    })
    expect(folderButton.parentElement?.querySelectorAll("svg")).toHaveLength(1)
    fireEvent.click(folderButton)
    expect(markOpened).toHaveBeenCalledWith(item.url, item.url)
  })

  it("uses a spinner for hydration and the shared empty state", () => {
    const commonProps = {
      selectedItemUrl: null,
      onSelectedItemUrlChange: vi.fn(),
      actions: createActions(),
      extractingItems: new Set<string>(),
      highlightedId: null,
    }
    const { rerender } = render(
      <SaveListBrowser items={[]} isHydrating {...commonProps} />
    )

    expect(
      screen.getByRole("status", { name: "Loading saved links…" })
    ).toBeVisible()

    rerender(
      <SaveListBrowser items={[]} isHydrating={false} {...commonProps} />
    )
    const emptyHeading = screen.getByRole("heading", {
      name: "No saved links yet",
    })
    expect(
      screen.queryByText("Add a link to save it for later.")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Add a link" })
    ).not.toBeInTheDocument()
    expect(emptyHeading.parentElement).not.toHaveClass("border", "rounded-2xl")
  })

  it("shows queue status and keeps an incomplete Saved link closed", () => {
    const item: LinkViewItem = {
      id: "queued-link",
      url: "https://source.example/queued",
      timestamp: Date.now(),
      title: "Queued Source",
      metadata: {
        schemaVersion: 3,
        source: {},
        extraction: { extractedLinks: [] },
        playback: { openedUrls: [] },
      },
      extractionStatus: { state: "running" },
    }

    render(
      <SaveListBrowser
        items={[{ ...item, kind: "saved" }]}
        selectedItemUrl={null}
        onSelectedItemUrlChange={vi.fn()}
        actions={createActions()}
        extractingItems={new Set()}
        highlightedId={null}
        isHydrating={false}
      />
    )

    const loadingLabel = screen.getByText("Loading links…")
    expect(loadingLabel).toBeVisible()
    expect(loadingLabel).toHaveClass("shimmer")
    expect(screen.queryByText("Queued Source")).not.toBeInTheDocument()
    const row = screen
      .getByRole("button", { name: "Loading links… for Queued Source" })
      .closest("[data-extraction-state]")
    expect(row).toHaveAttribute("data-extraction-state", "running")
    expect(
      screen.getByRole("button", { name: "Loading links… for Queued Source" })
    ).toBeDisabled()
    expect(row?.querySelector('[data-slot="spinner"]')).toBeInTheDocument()
  })
})

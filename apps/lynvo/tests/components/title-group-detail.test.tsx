import { MemoryRouter } from "react-router"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { TitleGroupDetail } from "~/features/links/components/title-group-detail"
import type { LinkListItem, ExtractedLink } from "~/features/links/types"

const createActions = (
  overrides: Partial<LinkItemActions> = {}
): LinkItemActions => ({
  play: vi.fn().mockResolvedValue({ accepted: true }),
  remove: vi.fn(),
  showLinks: vi.fn(),
  markOpened: vi.fn(),
  expandFolder: vi.fn().mockResolvedValue(null),
  softRefresh: vi.fn(),
  hardRefresh: vi.fn(),
  expandMirror: vi.fn().mockResolvedValue(null),
  ...overrides,
})

const createSource = (
  node: ExtractedLink,
  overrides: Partial<SourceVariantProjection> = {}
): SourceVariantProjection => ({
  id: "source-id",
  savedLinkId: "saved-id",
  occurrenceKey: "saved-id:0",
  nodeKey: node.nodeKey ?? "node-id",
  nodePath: "0",
  label: node.label,
  sourceName: "Example source",
  mediaNodeKind: node.mediaNodeKind,
  resolutionKind: node.resolutionKind,
  target: node.url,
  node,
  timestamp: 1,
  ...overrides,
})

const createGroup = (
  source: SourceVariantProjection
): TitleGroupProjection => ({
  id: "group-id",
  identityKey: "tv-season:example show:1",
  mediaKind: "tv-season",
  displayTitle: "Example Show",
  seasonNumber: 1,
  metadataState: "unavailable",
  lastAddedAt: 1,
  sourceCount: 1,
  entries: [
    {
      id: "entry-id",
      entryKey: "episode:1:1",
      kind: "episode",
      seasonNumber: 1,
      episodeStart: 1,
      displayLabel: "Episode 1",
      metadataState: "unavailable",
      sources: [source],
    },
  ],
})

const createDirectMediaGroup = (
  source: SourceVariantProjection
): TitleGroupProjection => ({
  id: "direct-group-id",
  identityKey: "movie:direct media:2026",
  mediaKind: "movie",
  displayTitle: "Clean direct title",
  year: 2026,
  metadataState: "unavailable",
  lastAddedAt: 1,
  sourceCount: 1,
  entries: [
    {
      id: "direct-entry-id",
      entryKey: `source:${source.occurrenceKey}`,
      kind: "unknown",
      displayLabel: "Clean direct title",
      metadataState: "unavailable",
      sources: [source],
    },
  ],
})

const createLinks = (node: ExtractedLink): LinkListItem[] => [
  {
    kind: "saved",
    id: "saved-id",
    url: "https://source.example/show",
    timestamp: 1,
    metadata: {
      schemaVersion: 3,
      source: { sourceName: "Example source" },
      extraction: { extractedLinks: [node] },
      playback: { openedUrls: [], openedIds: [] },
    },
  },
]

const renderDetail = (
  source: SourceVariantProjection,
  actions: LinkItemActions = createActions()
) =>
  render(
    <MemoryRouter>
      <TitleGroupDetail
        group={createGroup(source)}
        links={createLinks(source.node)}
        actions={actions}
      />
    </MemoryRouter>
  )

const renderDirectMediaDetail = (
  source: SourceVariantProjection,
  actions: LinkItemActions = createActions()
) =>
  render(
    <MemoryRouter>
      <TitleGroupDetail
        group={createDirectMediaGroup(source)}
        links={createLinks(source.node)}
        actions={actions}
      />
    </MemoryRouter>
  )

describe("TitleGroupDetail", () => {
  it("uses the compact real-filename list for direct media", () => {
    const node: ExtractedLink = {
      nodeKey: "direct-node",
      url: "https://media.example/direct-media.mkv",
      label: "Direct media.mkv",
      type: "file",
      mediaNodeKind: "playable",
    }

    renderDirectMediaDetail(createSource(node))

    expect(
      screen.getByRole("heading", { name: "Direct media.mkv" })
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Direct media.mkv Example source" })
    ).toBeVisible()
    const directMediaRow = screen.getByRole("button", {
      name: "Direct media.mkv Example source",
    })
    const directMediaMenu = screen.getByRole("button", {
      name: "Open menu for Direct media.mkv",
    })
    const headerMenu = screen.getByRole("button", {
      name: "Open menu for https://source.example/show",
    })
    expect(headerMenu.closest("header")).toHaveClass(
      "pe-0",
      "md:ps-6",
      "md:py-0"
    )
    expect(headerMenu).toHaveClass(
      "size-full!",
      "rounded-none!",
      "[&_svg]:size-7!"
    )
    expect(headerMenu.parentElement).toHaveClass(
      "w-16",
      "md:h-full",
      "border-s",
      "border-border/70"
    )
    expect(directMediaRow.querySelector("p")).toHaveClass(
      "text-sm",
      "md:text-lg",
      "font-heading"
    )
    expect(directMediaRow.querySelector("p")).not.toHaveClass("font-semibold")
    expect(directMediaMenu).toHaveClass("size-full!", "rounded-none!")
    expect(directMediaMenu.parentElement).toHaveClass(
      "w-16",
      "border-s",
      "border-border/70"
    )
    expect(screen.getAllByText("New")).toHaveLength(2)
    expect(
      screen.queryByRole("button", { name: "Show episode titles" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Switch to grid view" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Use card grid" })
    ).not.toBeInTheDocument()
  })

  it("plays a direct playable source", async () => {
    const node: ExtractedLink = {
      nodeKey: "playable-node",
      url: "https://media.example/episode.mkv",
      label: "Episode 1.mkv",
      type: "file",
      mediaNodeKind: "playable",
    }
    const play = vi.fn().mockResolvedValue({ accepted: true })
    renderDetail(createSource(node), createActions({ play }))

    fireEvent.click(
      screen.getByRole("button", { name: "EP 1 Episode 1 Example source" })
    )

    await waitFor(() => expect(play).toHaveBeenCalledWith(node))
  })

  it("resolves a mirror source before playing", async () => {
    const node: ExtractedLink = {
      nodeKey: "resolvable-node",
      url: "https://media.example/episode.mkv",
      label: "Episode 1.mkv",
      type: "file",
      mediaNodeKind: "resolvable",
    }
    const expandMirror = vi.fn().mockResolvedValue([
      {
        nodeKey: "mirror-node",
        url: "https://media.example/mirror.mkv",
        label: "Mirror",
        type: "file",
        mediaNodeKind: "playable",
      },
    ])
    const play = vi.fn().mockResolvedValue({ accepted: true })
    renderDetail(createSource(node), createActions({ expandMirror, play }))

    fireEvent.click(
      screen.getByRole("button", { name: "EP 1 Episode 1 Example source" })
    )

    await waitFor(() =>
      expect(expandMirror).toHaveBeenCalledWith(
        "https://source.example/show",
        "https://media.example/episode.mkv"
      )
    )
    await waitFor(() => expect(play).toHaveBeenCalled())
  })

  it("keeps folder sources in the same detail shell", async () => {
    const node: ExtractedLink = {
      id: "folder-node",
      nodeKey: "folder-node",
      url: "https://media.example/season/",
      label: "Season folder",
      type: "folder",
      mediaNodeKind: "group",
    }
    const child: ExtractedLink = {
      nodeKey: "episode-two",
      url: "https://media.example/episode-two.mkv",
      label: "Episode 2.mkv",
      type: "file",
      mediaNodeKind: "playable",
    }
    const expandFolder = vi.fn().mockResolvedValue([child])
    renderDetail(createSource(node), createActions({ expandFolder }))

    expect(screen.getByRole("heading", { name: "Example Show" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: /Episode 1/i }))

    await waitFor(() =>
      expect(expandFolder).toHaveBeenCalledWith(
        "https://source.example/show",
        "folder-node",
        "https://media.example/season/"
      )
    )
    expect(await screen.findByText("Episode 2.mkv")).toBeVisible()
    expect(
      screen.getByRole("navigation", { name: "Folder path" })
    ).toHaveTextContent("Season folder")
  })
})

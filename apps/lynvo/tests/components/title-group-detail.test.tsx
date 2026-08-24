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

describe("TitleGroupDetail", () => {
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

    fireEvent.click(screen.getByRole("button", { name: /Episode 1/i }))

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

    fireEvent.click(screen.getByRole("button", { name: /Episode 1/i }))

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

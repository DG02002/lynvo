import { describe, expect, it } from "vitest"
import { projectTitleGroups } from "~/features/links/title-grouping/title-group-projection"
import type { ExtractedLink, LinkListItem } from "~/features/links/types"

interface SavedLinkFixtureInput {
  readonly id: string
  readonly timestamp: number
  readonly title?: string
  readonly extractedLinks: ExtractedLink[]
}

const createSavedLink = ({
  id,
  timestamp,
  title,
  extractedLinks,
}: SavedLinkFixtureInput): LinkListItem => ({
  kind: "saved",
  id,
  url: `https://source.example/${id}`,
  timestamp,
  title,
  metadata: {
    schemaVersion: 3,
    source: { sourceName: `Source ${id}` },
    extraction: { extractedLinks },
    playback: { openedUrls: [], openedIds: [] },
  },
})

const createFile = (
  label: string,
  overrides: Partial<ExtractedLink> = {}
): ExtractedLink => ({
  nodeKey: `node:${label}`,
  label,
  type: "file",
  mediaNodeKind: "playable",
  url: `https://media.example/${encodeURIComponent(label)}`,
  ...overrides,
})

describe("projectTitleGroups", () => {
  it("merges later episodes into one title and season group", () => {
    const projection = projectTitleGroups([
      createSavedLink({
        id: "danger-episode-1",
        timestamp: 100,
        extractedLinks: [
          createFile("The_Dangers_in_My_Heart_S02E01_1080p.mkv"),
        ],
      }),
      createSavedLink({
        id: "danger-episode-2",
        timestamp: 200,
        extractedLinks: [
          createFile("The_Dangers_in_My_Heart_S02E02_1080p.mkv"),
        ],
      }),
    ])

    expect(projection.dateGroups).toHaveLength(1)
    expect(projection.dateGroups[0]?.groups).toHaveLength(1)
    expect(projection.dateGroups[0]?.groups[0]).toMatchObject({
      displayTitle: "The Dangers in My Heart",
      mediaKind: "tv-season",
      seasonNumber: 2,
      sourceCount: 2,
    })
    expect(
      projection.dateGroups[0]?.groups[0]?.entries.map(
        (entry) => entry.entryKey
      )
    ).toEqual(["episode:2:1", "episode:2:2"])
  })

  it("keeps different seasons separate", () => {
    const projection = projectTitleGroups([
      createSavedLink({
        id: "show-season-1",
        timestamp: 100,
        extractedLinks: [createFile("Example_Show_S01E01.mkv")],
      }),
      createSavedLink({
        id: "show-season-2",
        timestamp: 200,
        extractedLinks: [createFile("Example_Show_S02E01.mkv")],
      }),
    ])

    expect(projection.dateGroups[0]?.groups).toHaveLength(2)
    expect(
      projection.dateGroups[0]?.groups.map((group) => group.seasonNumber)
    ).toEqual([2, 1])
  })

  it("merges duplicate source variants inside one episode entry", () => {
    const projection = projectTitleGroups([
      createSavedLink({
        id: "source-alpha",
        timestamp: 100,
        extractedLinks: [createFile("Example_Show_S01E01_1080p.mkv")],
      }),
      createSavedLink({
        id: "source-beta",
        timestamp: 200,
        extractedLinks: [createFile("Example.Show.S01E01.720p.mkv")],
      }),
    ])

    const group = projection.dateGroups[0]?.groups[0]
    expect(group?.entries).toHaveLength(1)
    expect(group?.entries[0]?.sources).toHaveLength(2)
    expect(group?.sourceCount).toBe(2)
  })

  it("merges movie variants into one movie entry", () => {
    const projection = projectTitleGroups([
      createSavedLink({
        id: "movie-alpha",
        timestamp: 100,
        extractedLinks: [createFile("Backrooms (2026) 2160p.mkv")],
      }),
      createSavedLink({
        id: "movie-beta",
        timestamp: 200,
        extractedLinks: [createFile("Backrooms.2026.1080p.WEB-DL.mkv")],
      }),
    ])

    const group = projection.dateGroups[0]?.groups[0]
    expect(group).toMatchObject({
      displayTitle: "Backrooms",
      mediaKind: "movie",
      year: 2026,
    })
    expect(group?.entries).toHaveLength(1)
    expect(group?.entries[0]?.sources).toHaveLength(2)
  })

  it("keeps an episode range as one entry", () => {
    const projection = projectTitleGroups([
      createSavedLink({
        id: "naruto-range",
        timestamp: 100,
        extractedLinks: [
          createFile("Naruto Shippuden (2007) S06[E129-143].mkv"),
        ],
      }),
    ])

    expect(projection.dateGroups[0]?.groups[0]?.entries).toMatchObject([
      {
        kind: "episode-range",
        episodeStart: 129,
        episodeEnd: 143,
        displayLabel: "Episodes 129–143",
      },
    ])
  })

  it("uses a season folder as context for nested episode files", () => {
    const projection = projectTitleGroups([
      createSavedLink({
        id: "season-folder",
        timestamp: 100,
        extractedLinks: [
          {
            nodeKey: "folder:season-4",
            label: "Chilling_Adventures_of_Sabrina_2020_S04",
            type: "folder",
            mediaNodeKind: "group",
            children: [
              createFile("Episode 01.mkv"),
              createFile("Episode 02.mkv"),
            ],
          },
        ],
      }),
    ])

    expect(projection.dateGroups[0]?.groups).toHaveLength(1)
    expect(projection.dateGroups[0]?.groups[0]).toMatchObject({
      displayTitle: "Chilling Adventures of Sabrina",
      seasonNumber: 4,
    })
    expect(projection.dateGroups[0]?.groups[0]?.entries).toHaveLength(2)
  })

  it("groups by the newest member's local save date", () => {
    const currentDate = new Date(2026, 7, 23, 12, 0, 0)
    const projection = projectTitleGroups(
      [
        createSavedLink({
          id: "today-movie",
          timestamp: new Date(2026, 7, 23, 8, 0, 0).getTime(),
          extractedLinks: [createFile("Today Movie (2026).mkv")],
        }),
        createSavedLink({
          id: "yesterday-show",
          timestamp: new Date(2026, 7, 22, 8, 0, 0).getTime(),
          extractedLinks: [createFile("Yesterday Show S01E01.mkv")],
        }),
      ],
      currentDate.getTime()
    )

    expect(projection.dateGroups.map((group) => group.label)).toEqual([
      "Today",
      new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(
        new Date(2026, 7, 22, 8, 0, 0)
      ),
    ])
  })

  it("keeps ambiguous and unmatched sources in separate unmatched groups", () => {
    const projection = projectTitleGroups([
      createSavedLink({
        id: "ambiguous-source",
        timestamp: 100,
        extractedLinks: [createFile("Show S01E01 S01E02.mkv")],
      }),
      createSavedLink({
        id: "unmatched-source",
        timestamp: 200,
        extractedLinks: [createFile("video.mkv")],
      }),
    ])

    expect(projection.dateGroups).toHaveLength(0)
    expect(projection.unmatchedGroups).toHaveLength(2)
    expect(
      projection.unmatchedGroups.every(
        (group) => group.mediaKind === "unmatched"
      )
    ).toBe(true)
    expect(
      projection.unmatchedGroups.flatMap((group) =>
        group.entries.flatMap((entry) => entry.sources)
      )
    ).toHaveLength(2)
  })

  it("removes a title when its last source is deleted", () => {
    const source = createSavedLink({
      id: "deleted-source",
      timestamp: 100,
      extractedLinks: [createFile("Backrooms (2026).mkv")],
    })

    expect(projectTitleGroups([source]).dateGroups).toHaveLength(1)
    expect(projectTitleGroups([]).dateGroups).toHaveLength(0)
  })
})

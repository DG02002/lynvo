import type { ExtractedLink, MetaData } from "./types"

export interface DemoSavedLinkSeed {
  readonly url: string
  readonly meta: MetaData
  readonly extractedLinks: ExtractedLink[]
}

export const DEMO_LAZY_FOLDER_URL =
  "https://demo.lynvo.local/fixtures/lazy-folder"
export const DEMO_MIRROR_CONTAINER_URL =
  "https://demo.lynvo.local/fixtures/mirror-container"

const DEMO_DARK_KNIGHT_MEDIA_URL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
const DEMO_FOLDER_URL = "https://demo.lynvo.local/fixtures/loaded-folder"
const DEMO_MIRROR_CONTAINER_NODE_URL = DEMO_MIRROR_CONTAINER_URL
const DEMO_LAZY_FOLDER_SOURCE_URL =
  "https://demo.lynvo.local/fixtures/lazy-folder-source"
const DEMO_BREAKING_BAD_SOURCE_URL =
  "https://demo.lynvo.local/fixtures/breaking-bad"
const DEMO_BREAKING_BAD_SEASON_ONE_URL = `${DEMO_BREAKING_BAD_SOURCE_URL}/season-1`
const DEMO_BREAKING_BAD_SEASON_TWO_URL = `${DEMO_BREAKING_BAD_SOURCE_URL}/season-2`
const DEMO_BREAKING_BAD_EPISODE_ONE_URL = `${DEMO_BREAKING_BAD_SEASON_ONE_URL}/s01e01`
const DEMO_BREAKING_BAD_EPISODE_TWO_URL = `${DEMO_BREAKING_BAD_SEASON_ONE_URL}/s01e02`
const DEMO_BREAKING_BAD_EPISODE_THREE_URL = `${DEMO_BREAKING_BAD_SEASON_TWO_URL}/s02e01`
const DEMO_BREAKING_BAD_EPISODE_FOUR_URL = `${DEMO_BREAKING_BAD_SEASON_TWO_URL}/s02e02`
const DEMO_MATRIX_MIRROR_ALPHA_URL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"
const DEMO_MATRIX_MIRROR_BETA_URL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
const DEMO_TWO_TOWERS_VIDEO_URL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"

const createDemoMeta = (title: string): MetaData => ({
  title,
  pluginName: "Lynvo demo fixtures",
  sourceName: "Lynvo demo fixtures",
})

export const getDemoSavedLinkSeeds = (): DemoSavedLinkSeed[] => [
  {
    url: DEMO_DARK_KNIGHT_MEDIA_URL,
    meta: {
      ...createDemoMeta("The Dark Knight"),
      filename: "The Dark Knight (2008).mp4",
      contentType: "video/mp4",
      rangeRequest: "supported",
    },
    extractedLinks: [
      {
        id: "demo-direct-media",
        nodeKey: "demo:direct-media",
        url: DEMO_DARK_KNIGHT_MEDIA_URL,
        label: "The Dark Knight (2008).mp4",
        type: "file",
        mediaNodeKind: "playable",
        rangeRequest: "supported",
        size: "158 MB",
        status: "up",
      },
    ],
  },
  {
    url: DEMO_FOLDER_URL,
    meta: createDemoMeta("Stranger Things"),
    extractedLinks: [
      {
        id: "demo-loaded-folder",
        nodeKey: "demo:loaded-folder",
        url: DEMO_FOLDER_URL,
        label: "Stranger Things (2016) Season 1",
        type: "folder",
        selectable: true,
        children: [
          {
            id: "demo-folder-video",
            nodeKey: "demo:loaded-folder:video",
            url: DEMO_MATRIX_MIRROR_ALPHA_URL,
            label:
              "Stranger Things (2016) S01E01 - The Vanishing of Will Byers.mp4",
            type: "file",
            mediaNodeKind: "playable",
            size: "15 MB",
            status: "up",
          },
          {
            id: "demo-folder-container",
            nodeKey: "demo:loaded-folder:container",
            url: `${DEMO_FOLDER_URL}/container`,
            label: "Stranger Things (2016) Season 1 Extras",
            type: "folder",
            selectable: false,
            children: [
              {
                id: "demo-folder-container-video",
                nodeKey: "demo:loaded-folder:container:video",
                url: DEMO_MATRIX_MIRROR_BETA_URL,
                label:
                  "Stranger Things (2016) S01E02 - The Weirdo on Maple Street.mp4",
                type: "file",
                mediaNodeKind: "playable",
                size: "42 MB",
                status: "up",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    url: DEMO_MIRROR_CONTAINER_URL,
    meta: createDemoMeta("The Matrix"),
    extractedLinks: [
      {
        id: "demo-mirror-container",
        nodeKey: "demo:mirror-container",
        nodeUrl: DEMO_MIRROR_CONTAINER_NODE_URL,
        label: "The Matrix (1999)",
        type: "folder",
        mediaNodeKind: "resolvable",
        resolutionKind: "mirrors",
        size: "8.2 GB",
      },
    ],
  },
  {
    url: DEMO_LAZY_FOLDER_SOURCE_URL,
    meta: createDemoMeta("The Lord of the Rings: The Fellowship of the Ring"),
    extractedLinks: [
      {
        id: "demo-lazy-folder",
        nodeKey: "demo:lazy-folder",
        nodeUrl: DEMO_LAZY_FOLDER_URL,
        label: "The Lord of the Rings: The Fellowship of the Ring (2001)",
        type: "folder",
        mediaNodeKind: "resolvable",
        resolutionKind: "folder",
        childrenResolved: false,
      },
    ],
  },
  {
    url: DEMO_BREAKING_BAD_SOURCE_URL,
    meta: createDemoMeta("Breaking Bad"),
    extractedLinks: [
      {
        id: "demo-breaking-bad-season-one",
        nodeKey: "demo:breaking-bad:season-one",
        url: DEMO_BREAKING_BAD_SEASON_ONE_URL,
        label: "Breaking Bad (2008) Season 1",
        type: "folder",
        children: [
          {
            id: "demo-breaking-bad-episode-one",
            nodeKey: "demo:breaking-bad:season-one:episode-one",
            nodeUrl: DEMO_BREAKING_BAD_EPISODE_ONE_URL,
            label: "Breaking Bad (2008) S01E01 - Pilot",
            type: "folder",
            mediaNodeKind: "resolvable",
            resolutionKind: "mirrors",
            size: "1.1 GB",
          },
          {
            id: "demo-breaking-bad-episode-two",
            nodeKey: "demo:breaking-bad:season-one:episode-two",
            nodeUrl: DEMO_BREAKING_BAD_EPISODE_TWO_URL,
            label: "Breaking Bad (2008) S01E02 - Cat's in the Bag...",
            type: "folder",
            mediaNodeKind: "resolvable",
            resolutionKind: "mirrors",
            size: "1.3 GB",
          },
        ],
      },
      {
        id: "demo-breaking-bad-season-two",
        nodeKey: "demo:breaking-bad:season-two",
        url: DEMO_BREAKING_BAD_SEASON_TWO_URL,
        label: "Breaking Bad (2008) Season 2",
        type: "folder",
        children: [
          {
            id: "demo-breaking-bad-episode-three",
            nodeKey: "demo:breaking-bad:season-two:episode-one",
            nodeUrl: DEMO_BREAKING_BAD_EPISODE_THREE_URL,
            label: "Breaking Bad (2008) S02E01 - Seven Thirty-Seven",
            type: "folder",
            mediaNodeKind: "resolvable",
            resolutionKind: "mirrors",
            size: "1.2 GB",
          },
          {
            id: "demo-breaking-bad-episode-four",
            nodeKey: "demo:breaking-bad:season-two:episode-two",
            nodeUrl: DEMO_BREAKING_BAD_EPISODE_FOUR_URL,
            label: "Breaking Bad (2008) S02E02 - Grilled",
            type: "folder",
            mediaNodeKind: "resolvable",
            resolutionKind: "mirrors",
            size: "1.4 GB",
          },
        ],
      },
    ],
  },
]

export const getDemoMirrorLinks = (): ExtractedLink[] => [
  {
    id: "demo-mirror-alpha",
    nodeKey: "demo:mirror-container:alpha",
    url: DEMO_MATRIX_MIRROR_ALPHA_URL,
    label: "The Matrix (1999) - 1080p.mp4",
    type: "file",
    mediaNodeKind: "playable",
    size: "15 MB",
    status: "up",
  },
  {
    id: "demo-mirror-beta",
    nodeKey: "demo:mirror-container:beta",
    url: DEMO_MATRIX_MIRROR_BETA_URL,
    label: "The Matrix (1999) - 2160p.mp4",
    type: "file",
    mediaNodeKind: "playable",
    size: "42 MB",
    status: "up",
  },
  {
    id: "demo-mirror-down",
    nodeKey: "demo:mirror-container:down",
    url: "https://demo.lynvo.local/fixtures/unavailable-mirror.mp4",
    label: "The Matrix (1999) - unavailable.mp4",
    type: "file",
    mediaNodeKind: "playable",
    status: "down",
  },
]

export const getDemoLazyFolderChildren = (): ExtractedLink[] => [
  {
    id: "demo-lazy-folder-nested",
    nodeKey: "demo:lazy-folder:nested",
    url: `${DEMO_LAZY_FOLDER_URL}/nested`,
    label: "The Lord of the Rings Collection",
    type: "folder",
    selectable: true,
    children: [
      {
        id: "demo-lazy-folder-nested-video",
        nodeKey: "demo:lazy-folder:nested:video",
        url: DEMO_TWO_TOWERS_VIDEO_URL,
        label: "The Lord of the Rings: The Two Towers (2002).mp4",
        type: "file",
        mediaNodeKind: "playable",
        size: "13 MB",
        status: "up",
      },
    ],
  },
  {
    id: "demo-lazy-folder-video",
    nodeKey: "demo:lazy-folder:video",
    url: DEMO_DARK_KNIGHT_MEDIA_URL,
    label: "The Lord of the Rings: The Fellowship of the Ring (2001).mp4",
    type: "file",
    mediaNodeKind: "playable",
    size: "158 MB",
    status: "up",
  },
]

export const getDemoShowEpisodeMirrors = (
  episodeUrl: string
): ExtractedLink[] | undefined => {
  const mirrorsByEpisodeUrl = new Map<string, ExtractedLink[]>([
    [
      DEMO_BREAKING_BAD_EPISODE_ONE_URL,
      [
        {
          id: "demo-breaking-bad-episode-one-mirror",
          nodeKey: "demo:breaking-bad:episode-one:mirror",
          url: DEMO_MATRIX_MIRROR_ALPHA_URL,
          label: "Breaking Bad (2008) S01E01 - Pilot.mp4",
          type: "file",
          mediaNodeKind: "playable",
          size: "1.1 GB",
          status: "up",
        },
      ],
    ],
    [
      DEMO_BREAKING_BAD_EPISODE_TWO_URL,
      [
        {
          id: "demo-breaking-bad-episode-two-mirror",
          nodeKey: "demo:breaking-bad:episode-two:mirror",
          url: DEMO_MATRIX_MIRROR_BETA_URL,
          label: "Breaking Bad (2008) S01E02 - Cat's in the Bag....mp4",
          type: "file",
          mediaNodeKind: "playable",
          size: "1.3 GB",
          status: "up",
        },
      ],
    ],
    [
      DEMO_BREAKING_BAD_EPISODE_THREE_URL,
      [
        {
          id: "demo-breaking-bad-episode-three-mirror",
          nodeKey: "demo:breaking-bad:episode-three:mirror",
          url: DEMO_TWO_TOWERS_VIDEO_URL,
          label: "Breaking Bad (2008) S02E01 - Seven Thirty-Seven.mp4",
          type: "file",
          mediaNodeKind: "playable",
          size: "1.2 GB",
          status: "up",
        },
      ],
    ],
    [
      DEMO_BREAKING_BAD_EPISODE_FOUR_URL,
      [
        {
          id: "demo-breaking-bad-episode-four-mirror",
          nodeKey: "demo:breaking-bad:episode-four:mirror",
          url: DEMO_DARK_KNIGHT_MEDIA_URL,
          label: "Breaking Bad (2008) S02E02 - Grilled.mp4",
          type: "file",
          mediaNodeKind: "playable",
          size: "1.4 GB",
          status: "up",
        },
      ],
    ],
  ])
  return mirrorsByEpisodeUrl.get(episodeUrl)
}

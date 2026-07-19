import type { RecentLinkViewItem } from "~/features/links/types"
import {
  TEST_DRAFT_LIFETIME_MS,
  TEST_PLAYABLE_EXPIRY_AT_MS,
} from "~/features/links/testing/constants"

export const createSaveListTestItems = (): RecentLinkViewItem[] => {
  const timestamp = Date.now()

  return [
    {
      id: "selection-draft",
      url: "https://media.example/selection-draft",
      timestamp,
      title: "Draft awaiting link selection",
      isDraft: true,
      draftExpiresAt: timestamp + TEST_DRAFT_LIFETIME_MS,
      meta: {
        pluginName: "Spencerwooo's Onedrive Vercel Index",
        pluginIcon: "/icons/plugins/onedrive-index.webp",
        sourceName: "Spencerwooo's Onedrive Vercel Index",
        pageTitle: "Example Show — choose files to save",
        audio: "English AAC 5.1",
        workerId: "ui-test-onedrive-worker",
        extractedLinks: [
          {
            id: "draft-season-one",
            url: "https://media.example/selection-draft/season-one",
            label: "Season 1 — 1080p",
            type: "folder",
            selectable: true,
            children: [
              {
                id: "draft-option-one",
                url: "https://media.example/selection-draft/season-one/episode-one.mkv",
                label: "Example.Show.S01E01.1080p.mkv",
                type: "file",
                size: "1.2 GB",
              },
              {
                id: "draft-option-two",
                url: "https://media.example/selection-draft/season-one/episode-two.mkv",
                label: "Example.Show.S01E02.1080p.mkv",
                type: "file",
                size: "1.3 GB",
              },
              {
                id: "draft-option-three",
                url: "https://media.example/selection-draft/season-one/episode-three.mkv",
                label: "Example.Show.S01E03.1080p.mkv",
                type: "file",
                size: "1.1 GB",
              },
            ],
          },
          {
            id: "draft-season-two",
            url: "https://media.example/selection-draft/season-two",
            label: "Season 2 — 2160p",
            type: "folder",
            selectable: true,
            children: [
              {
                id: "draft-option-four",
                url: "https://media.example/selection-draft/season-two/episode-one.mkv",
                label: "Example.Show.S02E01.2160p.DDP5.1.mkv",
                type: "file",
                size: "4.8 GB",
              },
              {
                id: "draft-option-five",
                url: "https://media.example/selection-draft/season-two/episode-two.mkv",
                label: "Example.Show.S02E02.2160p.DDP5.1.mkv",
                type: "file",
                size: "4.6 GB",
              },
              {
                id: "draft-option-six",
                url: "https://media.example/selection-draft/season-two/episode-three.mkv",
                label: "Example.Show.S02E03.2160p.DDP5.1.mkv",
                type: "file",
                size: "5.0 GB",
              },
            ],
          },
          {
            id: "draft-featurette",
            url: "https://media.example/selection-draft/behind-the-scenes.mp4",
            label: "Behind the scenes featurette.mp4",
            type: "file",
            size: "380 MB",
          },
        ],
      },
    },
    {
      id: "direct-file",
      url: "https://media.example/direct-file",
      timestamp,
      title: "Direct file",
      metadata: {
        schemaVersion: 2,
        source: { pluginName: "Direct Media", sourceName: "Direct Media" },
        extraction: {
          extractedLinks: [
            {
              id: "direct-file-video",
              url: "https://media.example/video.mp4",
              label:
                "A direct filename with the same icon spacing as folder files.mp4",
              type: "file",
              size: "1.4 GB",
              status: "up",
            },
          ],
        },
        playback: { watchedUrls: [], watchedIds: [] },
      },
    },
    {
      id: "nested-library",
      url: "https://media.example/library",
      timestamp,
      title:
        "A very long saved library title that checks wrapping without pushing the item menu off screen",
      metadata: {
        schemaVersion: 2,
        source: { pluginName: "Library", sourceName: "Test Library" },
        extraction: {
          extractedLinks: [
            {
              id: "season-one",
              url: "https://media.example/library/season-one",
              label: "Season One",
              type: "folder",
              children: [
                {
                  id: "watched-episode",
                  url: "https://media.example/library/season-one/episode-one.mp4",
                  label: "Episode 1 — Watched file with a size",
                  type: "file",
                  size: "780 MB",
                },
                {
                  id: "long-episode",
                  url: "https://media.example/library/season-one/episode-with-a-very-long-name.mp4",
                  label:
                    "Episode 2 — A deliberately long filename that wraps across multiple lines and keeps every trailing action aligned",
                  type: "file",
                  size: "1.1 GB",
                },
                {
                  id: "nested-folder",
                  url: "https://media.example/library/season-one/extras",
                  label: "Extras",
                  type: "folder",
                  children: [
                    {
                      id: "nested-file",
                      url: "https://media.example/library/season-one/extras/interview.mp4",
                      label: "Cast interview.mp4",
                      type: "file",
                      size: "240 MB",
                    },
                  ],
                },
              ],
            },
          ],
        },
        playback: {
          watchedUrls: [
            "https://media.example/library/season-one/episode-one.mp4",
          ],
          watchedIds: [],
        },
      },
    },
    {
      id: "multiple-direct-files",
      url: "https://media.example/multiple-files",
      timestamp,
      title: "Multiple direct files without folders",
      metadata: {
        schemaVersion: 2,
        source: {
          pluginName: "Multi File",
          sourceName: "Mixed downloads",
          sourceStatus: "degraded",
        },
        extraction: {
          extractedLinks: [
            {
              id: "multiple-file-one",
              url: "https://media.example/multiple-files/one.mp4",
              label: "First file.mp4",
              type: "file",
              size: "400 MB",
              status: "up",
            },
            {
              id: "multiple-file-two",
              url: "https://media.example/multiple-files/two.mp4",
              label: "Second file with no reported size.mp4",
              type: "file",
              status: "up",
            },
          ],
        },
        playback: { watchedUrls: [], watchedIds: [] },
      },
    },
    {
      id: "expiring-direct-file",
      url: "https://media.example/expiring",
      timestamp,
      title: "Playable expiry test",
      metadata: {
        schemaVersion: 2,
        source: {
          pluginName: "Direct Media",
          sourceName: "Temporary CDN test fixture",
          sourceStatus: "active",
        },
        extraction: {
          extractedLinks: [
            {
              id: "expiring-video",
              url: "https://media.example/expiring/video.mp4",
              label: "Temporary 4K playback link.mp4",
              type: "file",
              size: "900 MB",
              expiry: TEST_PLAYABLE_EXPIRY_AT_MS,
              status: "up",
            },
          ],
        },
        playback: { watchedUrls: [], watchedIds: [] },
      },
    },
    {
      id: "fallback-title",
      url: "https://fallback-title.example/path/video.mp4",
      timestamp,
      metadata: {
        schemaVersion: 2,
        source: {},
        extraction: {
          extractedLinks: [
            {
              url: "https://fallback-title.example/path/video.mp4",
              label: "video.mp4",
              type: "file",
            },
          ],
        },
        playback: { watchedUrls: [], watchedIds: [] },
      },
    },
    {
      id: "source-alpha-mirrors",
      url: "https://source-alpha.example/example-series-series-season-1",
      timestamp,
      title: "Source Alpha series with resolved Resolver Beta mirrors",
      metadata: {
        schemaVersion: 2,
        source: {
          pluginName: "Example Extractor",
          sourceName: "Source Alpha",
          sourceIconUrl:
            "https://extractor.example/icons/plugins/source-alpha.webp",
          workerId: "ui-test-source-alpha-worker",
          audio: "Hindi DD5.1 + English AAC 5.1",
        },
        extraction: {
          extractedLinks: [
            {
              id: "source-alpha-season-one",
              url: "https://source-alpha.example/series/season-one",
              label: "Season 1",
              type: "folder",
              selectable: false,
              children: [
                {
                  id: "source-alpha-season-one-2160p",
                  url: "https://source-alpha.example/series/season-one/2160p",
                  label: "2160p 10bit",
                  type: "folder",
                  selectable: true,
                  children: [
                    {
                      id: "source-alpha-s01e01",
                      url: "https://resolver-beta.example/s01e01",
                      label: "Example.Series.S01E01.2160p.10bit.mkv",
                      type: "folder",
                      size: "5.8 GB",
                      workerNodeKind: "resolvable",
                    },
                    {
                      id: "source-alpha-s01e02",
                      url: "https://resolver-beta.example/s01e02",
                      label: "Example.Series.S01E02.2160p.10bit.mkv",
                      type: "folder",
                      size: "6.1 GB",
                      workerNodeKind: "resolvable",
                    },
                    {
                      id: "source-alpha-s01e03-failure",
                      url: "https://resolver-beta.example/resolution-failure",
                      label:
                        "Example.Series.S01E03.2160p.10bit.Resolve-Failure.mkv",
                      type: "folder",
                      size: "5.9 GB",
                      workerNodeKind: "resolvable",
                    },
                  ],
                },
              ],
            },
          ],
        },
        playback: { watchedUrls: [], watchedIds: [] },
      },
    },
  ]
}

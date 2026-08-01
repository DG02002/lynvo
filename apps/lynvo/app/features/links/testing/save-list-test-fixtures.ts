import type { LinkViewItem } from "~/features/links/types"
import {
  TEST_DRAFT_LIFETIME_MS,
  TEST_PLAYABLE_EXPIRY_AT_MS,
} from "~/features/links/testing/constants"

export const createSaveListTestItems = (): LinkViewItem[] => {
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
        pluginIcon: "/icons/sources/onedrive-index.webp",
        sourceName: "Spencerwooo's Onedrive Vercel Index",
        pageTitle: "Example Show — choose files to save",
        audio: "Audio Alpha",
        pluginServerId: "ui-test-onedrive-plugin-server",
        extractedLinks: [
          {
            id: "draft-folder-one",
            url: "https://media.example/selection-draft/folder-one",
            label: "Folder 1 — Variant Alpha",
            type: "folder",
            selectable: true,
            children: [
              {
                id: "draft-option-one",
                url: "https://media.example/selection-draft/folder-one/playable-item-one.mkv",
                label: "Example.Show.item-01.Variant Alpha.mkv",
                type: "file",
                size: "1.2 GB",
              },
              {
                id: "draft-option-two",
                url: "https://media.example/selection-draft/folder-one/playable-item-two.mkv",
                label: "Example.Show.item-02.Variant Alpha.mkv",
                type: "file",
                size: "1.3 GB",
              },
              {
                id: "draft-option-three",
                url: "https://media.example/selection-draft/folder-one/playable-item-three.mkv",
                label: "Example.Show.item-03.Variant Alpha.mkv",
                type: "file",
                size: "1.1 GB",
              },
            ],
          },
          {
            id: "draft-folder-two",
            url: "https://media.example/selection-draft/folder-two",
            label: "Folder 2 — Variant Beta",
            type: "folder",
            selectable: true,
            children: [
              {
                id: "draft-option-four",
                url: "https://media.example/selection-draft/folder-two/playable-item-one.mkv",
                label: "Example.Show.item-04.Variant Beta.Audio Beta.mkv",
                type: "file",
                size: "4.8 GB",
              },
              {
                id: "draft-option-five",
                url: "https://media.example/selection-draft/folder-two/playable-item-two.mkv",
                label: "Example.Show.item-05.Variant Beta.Audio Beta.mkv",
                type: "file",
                size: "4.6 GB",
              },
              {
                id: "draft-option-six",
                url: "https://media.example/selection-draft/folder-two/playable-item-three.mkv",
                label: "Example.Show.item-06.Variant Beta.Audio Beta.mkv",
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
        schemaVersion: 3,
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
        schemaVersion: 3,
        source: { pluginName: "Library", sourceName: "Test Library" },
        extraction: {
          extractedLinks: [
            {
              id: "folder-one",
              url: "https://media.example/library/folder-one",
              label: "Folder One",
              type: "folder",
              children: [
                {
                  id: "watched-playable-item",
                  url: "https://media.example/library/folder-one/playable-item-one.mp4",
                  label: "Playable Item 1 — Watched file with a size",
                  type: "file",
                  size: "780 MB",
                },
                {
                  id: "long-playable-item",
                  url: "https://media.example/library/folder-one/playable-item-with-a-very-long-name.mp4",
                  label:
                    "Playable Item 2 — A deliberately long filename that wraps across multiple lines and keeps every trailing action aligned",
                  type: "file",
                  size: "1.1 GB",
                },
                {
                  id: "nested-folder",
                  url: "https://media.example/library/folder-one/extras",
                  label: "Extras",
                  type: "folder",
                  children: [
                    {
                      id: "nested-file",
                      url: "https://media.example/library/folder-one/extras/interview.mp4",
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
            "https://media.example/library/folder-one/playable-item-one.mp4",
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
        schemaVersion: 3,
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
        schemaVersion: 3,
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
        schemaVersion: 3,
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
      url: "https://source-alpha.example/example-collection-collection-folder-1",
      timestamp,
      title: "Source Alpha collection with resolved Resolver Beta mirrors",
      metadata: {
        schemaVersion: 3,
        source: {
          pluginName: "Example Plugin Server",
          sourceName: "Source Alpha",
          sourceIconUrl:
            "https://plugin-server.example/icons/sources/source-alpha.webp",
          pluginServerId: "ui-test-source-alpha-plugin-server",
          audio: "Hindi DD5.1 + Audio Alpha",
        },
        extraction: {
          extractedLinks: [
            {
              id: "source-alpha-folder-one",
              url: "https://source-alpha.example/collection/folder-one",
              label: "Folder 1",
              type: "folder",
              selectable: false,
              children: [
                {
                  id: "source-alpha-folder-one-Variant Beta",
                  url: "https://source-alpha.example/collection/folder-one/Variant Beta",
                  label: "Variant Beta",
                  type: "folder",
                  selectable: true,
                  children: [
                    {
                      id: "source-alpha-item-01",
                      url: "https://resolver-beta.example/item-01",
                      label:
                        "Example.Collection.item-01.Variant Beta.Variant Beta.mkv",
                      type: "folder",
                      size: "5.8 GB",
                      mediaNodeKind: "resolvable",
                    },
                    {
                      id: "source-alpha-item-02",
                      url: "https://resolver-beta.example/item-02",
                      label:
                        "Example.Collection.item-02.Variant Beta.Variant Beta.mkv",
                      type: "folder",
                      size: "6.1 GB",
                      mediaNodeKind: "resolvable",
                    },
                    {
                      id: "source-alpha-item-03-failure",
                      url: "https://resolver-beta.example/resolution-failure",
                      label:
                        "Example.Collection.item-03.Variant Beta.Variant Beta.Resolve-Failure.mkv",
                      type: "folder",
                      size: "5.9 GB",
                      mediaNodeKind: "resolvable",
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

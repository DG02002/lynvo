import { afterEach, describe, expect, it, vi } from "vitest"
import { OFFICIAL_SOURCE_CATALOG } from "../src/source-catalog"
import {
  createBhadooNodes,
  extractBhadooGoogleDriveIndex,
  formatBhadooFileSize,
} from "../src/sources/bhadoo-google-drive-index"
import {
  createOneDriveNodes,
  extractOneDriveIndex,
} from "../src/sources/onedrive-index"

afterEach(() => vi.restoreAllMocks())

describe("Bhadoo source adapter", () => {
  const source = OFFICIAL_SOURCE_CATALOG[0]

  it("maps folders and playable files to protocol-native nodes", () => {
    const nodes = createBhadooNodes(
      [
        {
          id: "folder-1",
          name: "Season 1",
          mimeType: "application/vnd.google-apps.folder",
        },
        {
          id: "file-1",
          name: "episode.mkv",
          mimeType: "video/x-matroska",
          size: "492077810",
          link: "/download.aspx?file=signed",
        },
        { id: "image-1", name: "poster.jpg", mimeType: "image/jpeg" },
      ],
      new URL("https://drive.example/0:/Shows/")
    )
    expect(nodes).toMatchObject([
      { kind: "resolvable", label: "Season 1" },
      { kind: "playable", label: "episode.mkv", size: "469.28 MB" },
    ])
    expect(formatBhadooFileSize("492077810")).toBe("469.28 MB")
  })

  it("forwards structured HTTP Basic Auth without URL credentials", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        nextPageToken: null,
        curPageIndex: 0,
        data: { files: [] },
      })
    )
    await extractBhadooGoogleDriveIndex({
      request: {
        input: { kind: "source", sourceUrl: "https://drive.example/0:/" },
        basicAuth: { username: "viewer", password: "secret" },
      },
      targetUrl: "https://drive.example/0:/",
      source,
      publicAssetOrigin: "https://lynvo.example",
    })
    const calledRequest = fetchSpy.mock.calls[0]
    expect(String(calledRequest[0])).toBe("https://drive.example/0:/")
    expect(calledRequest[1]?.headers).toMatchObject({
      Authorization: `Basic ${btoa("viewer:secret")}`,
    })
  })
})

describe("OneDrive source adapter", () => {
  const source = OFFICIAL_SOURCE_CATALOG[1]

  it("maps folders and video files while skipping unrelated files", () => {
    const nodes = createOneDriveNodes(
      [
        { id: "folder-1", name: "Season 1", folder: {} },
        { id: "file-1", name: "episode.mp4", file: {} },
        { id: "image-1", name: "cover.jpg", file: {} },
      ],
      "/Shows",
      "https://index.example",
      "token"
    )
    expect(nodes).toMatchObject([
      { kind: "resolvable", label: "Season 1" },
      { kind: "playable", label: "episode.mp4" },
    ])
  })

  it("extracts Next.js page data and forwards a hashed domain password", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        '<script id="__NEXT_DATA__" type="application/json">' +
          JSON.stringify({
            props: {
              pageProps: {
                folder: {
                  value: [{ id: "file-1", name: "episode.mp4", file: {} }],
                },
              },
            },
          }) +
          "</script>"
      )
    )
    const result = await extractOneDriveIndex({
      request: {
        input: { kind: "source", sourceUrl: "https://index.example/Shows" },
        password: "domain-password",
      },
      targetUrl: "https://index.example/Shows",
      source,
      publicAssetOrigin: "https://lynvo.example",
    })
    expect(result.nodes).toMatchObject([{ kind: "playable" }])
    expect(fetchSpy.mock.calls[0][1]?.headers).toHaveProperty(
      "od-protected-token"
    )
  })
})

import { afterEach, describe, expect, it, vi } from "vitest"
import { ProtocolError } from "@dg02002/lynvo-plugin-server-protocol"
import { LYNVO_PLUGIN_CATALOG } from "../src/plugin-catalog"
import {
  BHADOO_REVERSE_ENVELOPE_PREFIX_CHARACTER_COUNT,
  BHADOO_REVERSE_ENVELOPE_SUFFIX_CHARACTER_COUNT,
} from "../src/constants"
import {
  createBhadooNodes,
  extractBhadooGoogleDriveIndex,
  formatBhadooFileSize,
  type BhadooGoogleDriveListResponse,
} from "../src/sources/bhadoo-google-drive-index"
import {
  createOneDriveNodes,
  extractOneDriveIndex,
} from "../src/sources/onedrive-index"
import {
  createGoogleDriveDownloadUrl,
  createGoogleDrivePublicFolderNodes,
  extractGoogleDriveFolderId,
  extractGoogleDriveFileId,
  extractGoogleDrivePublicFile,
  extractGoogleDrivePublicFolder,
  fetchGoogleDrivePublicFileMetadata,
  parseGoogleDrivePublicFolderItems,
} from "../src/sources/google-drive-public-files"
import { extractDirectMedia } from "../src/sources/direct-media"

afterEach(() => vi.restoreAllMocks())

const createBhadooReverseEnvelope = (
  response: BhadooGoogleDriveListResponse
): string => {
  const wrappedResponse = `${"p".repeat(
    BHADOO_REVERSE_ENVELOPE_PREFIX_CHARACTER_COUNT
  )}${btoa(JSON.stringify(response))}${"s".repeat(
    BHADOO_REVERSE_ENVELOPE_SUFFIX_CHARACTER_COUNT
  )}`
  return wrappedResponse.split("").reverse().join("")
}

describe("Direct Media source adapter", () => {
  const plugin = LYNVO_PLUGIN_CATALOG.find(
    (candidate) => candidate.id === "direct-media"
  )!

  it("returns playable metadata when an upstream honors the range probe", async () => {
    const upstreamResponse = new Response(new Uint8Array([0]), {
      status: 206,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="example-video.mp4"',
        "Content-Range": "bytes 0-0/1105713",
      },
    })
    const cancel = vi.spyOn(upstreamResponse.body!, "cancel")
    vi.spyOn(globalThis, "fetch").mockResolvedValue(upstreamResponse)

    const result = await extractDirectMedia({
      request: {
        input: {
          kind: "source",
          sourceUrl: "https://media.example/example-video.mp4",
        },
      },
      targetUrl: "https://media.example/example-video.mp4",
      plugin,
      publicAssetOrigin: "https://lynvo.example",
    })

    expect(result).toMatchObject({
      plugin: { pluginId: "direct-media", pluginName: "Direct Media" },
      nodes: [
        {
          kind: "playable",
          label: "example-video.mp4",
          url: "https://media.example/example-video.mp4",
          size: "1.05 MB",
          status: "up",
          rangeRequest: "supported",
        },
      ],
    })
    expect(cancel).toHaveBeenCalledOnce()
  })

  it("marks ignored ranges unsupported and preserves signed URL expiry", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([0]), {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": "1105713",
        },
      })
    )

    const result = await extractDirectMedia({
      request: {
        input: {
          kind: "source",
          sourceUrl: "https://media.example/video.mp4?Expires=1798761600",
        },
      },
      targetUrl: "https://media.example/video.mp4?Expires=1798761600",
      plugin,
    })

    expect(result.nodes[0]).toMatchObject({
      rangeRequest: "unsupported",
      size: "1.05 MB",
      expiry: 1_798_761_600_000,
      expirySource: "signed-url",
    })
  })

  it("rejects non-media files served as generic binary content", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([0]), {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": 'attachment; filename="archive.zip"',
        },
      })
    )

    await expect(
      extractDirectMedia({
        request: {
          input: {
            kind: "source",
            sourceUrl: "https://media.example/archive.zip",
          },
        },
        targetUrl: "https://media.example/archive.zip",
        plugin,
      })
    ).rejects.toMatchObject({ code: "UNSUPPORTED_URL" })
  })
})

describe("Bhadoo source adapter", () => {
  const plugin = LYNVO_PLUGIN_CATALOG[0]

  it("extracts a Bhadoo download endpoint as direct media", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([0]), {
        status: 206,
        headers: {
          "Content-Type": "video/x-matroska",
          "Content-Disposition":
            'attachment; filename="Sample.Movie.2016.1080p.mkv"',
          "Content-Range": "bytes 0-0/3912361197",
        },
      })
    )

    const result = await extractBhadooGoogleDriveIndex({
      request: {
        input: {
          kind: "source",
          sourceUrl: "https://drive.example/download.aspx?file=signed",
        },
      },
      targetUrl: "https://drive.example/download.aspx?file=signed",
      plugin,
      publicAssetOrigin: "https://lynvo.example",
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        "Accept-Encoding": "identity",
        Range: "bytes=0-0",
      },
    })
    expect(result.nodes).toEqual([
      expect.objectContaining({
        kind: "playable",
        label: "Sample.Movie.2016.1080p.mkv",
        rangeRequest: "supported",
        size: "3.64 GB",
      }),
    ])
  })

  it("maps folders and playable files to protocol-native nodes", () => {
    const nodes = createBhadooNodes(
      [
        {
          id: "folder-1",
          name: "Folder 1",
          mimeType: "application/vnd.google-apps.folder",
        },
        {
          id: "file-1",
          name: "playable-item.mkv",
          mimeType: "video/x-matroska",
          size: "492077810",
          link: "/download.aspx?file=signed",
        },
        { id: "image-1", name: "poster.jpg", mimeType: "image/jpeg" },
      ],
      new URL("https://drive.example/0:/Collections/")
    )
    expect(nodes).toMatchObject([
      {
        kind: "resolvable",
        label: "Folder 1",
        resolutionKind: "folder",
      },
      { kind: "playable", label: "playable-item.mkv", size: "469.28 MB" },
    ])
    expect(formatBhadooFileSize("492077810")).toBe("469.28 MB")
  })

  it("extracts fallback folders through the fallback API", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          id: "encoded-folder-token",
          name: "Business Proposal",
          mimeType: "application/vnd.google-apps.folder",
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          nextPageToken: null,
          curPageIndex: 0,
          data: {
            files: [
              {
                id: "child-folder",
                name: "Season 1",
                mimeType: "application/vnd.google-apps.folder",
              },
              {
                id: "video-file",
                name: "episode-01.mkv",
                mimeType: "video/x-matroska",
                size: "492077810",
                link: "/download.aspx?file=signed",
              },
            ],
          },
        })
      )

    const targetUrl = "https://index.example/fallback?id=encoded-folder-token&"
    const result = await extractBhadooGoogleDriveIndex({
      request: {
        input: { kind: "source", sourceUrl: targetUrl },
      },
      targetUrl,
      plugin,
      publicAssetOrigin: "https://lynvo.example",
    })

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    const calledItemRequest = fetchSpy.mock.calls[0]
    expect(String(calledItemRequest?.[0])).toBe(
      "https://index.example/0:fallback"
    )
    expect(JSON.parse(String(calledItemRequest?.[1]?.body))).toEqual({
      id: "encoded-folder-token",
    })
    const calledRequest = fetchSpy.mock.calls[1]
    expect(String(calledRequest?.[0])).toBe("https://index.example/0:fallback")
    expect(calledRequest?.[1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    expect(JSON.parse(String(calledRequest?.[1]?.body))).toEqual({
      id: "encoded-folder-token",
      type: "folder",
      password: "",
      page_token: "",
      page_index: 0,
    })
    expect(result.nodes).toMatchObject([
      {
        kind: "resolvable",
        label: "Season 1",
        nodeUrl: "https://index.example/fallback?id=child-folder",
      },
      {
        kind: "playable",
        label: "episode-01.mkv",
        url: "https://index.example/download.aspx?file=signed",
      },
    ])
    expect(result.plugin.pageTitle).toBe("Business Proposal")
  })

  it("extracts fallback file views through the fallback API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        id: "video-file",
        name: "episode-01.mkv",
        mimeType: "video/x-matroska",
        size: "492077810",
        link: "/download.aspx?file=signed",
      })
    )

    const targetUrl =
      "https://index.example/fallback?id=encoded-file-token&a=view"
    const result = await extractBhadooGoogleDriveIndex({
      request: {
        input: { kind: "source", sourceUrl: targetUrl },
      },
      targetUrl,
      plugin,
      publicAssetOrigin: "https://lynvo.example",
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const calledRequest = fetchSpy.mock.calls[0]
    expect(String(calledRequest?.[0])).toBe("https://index.example/0:fallback")
    expect(JSON.parse(String(calledRequest?.[1]?.body))).toEqual({
      id: "encoded-file-token",
    })
    expect(result.nodes).toMatchObject([
      {
        kind: "playable",
        label: "episode-01.mkv",
        url: "https://index.example/download.aspx?file=signed",
      },
    ])
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
      plugin,
      publicAssetOrigin: "https://lynvo.example",
    })
    const calledRequest = fetchSpy.mock.calls[0]
    expect(String(calledRequest[0])).toBe("https://drive.example/0:/")
    expect(calledRequest[1]?.headers).toMatchObject({
      Authorization: `Basic ${btoa("viewer:secret")}`,
    })
  })

  it("supports the Bhadoo reverse-envelope response protocol", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("JSON endpoint unavailable", { status: 404 })
      )
      .mockResolvedValueOnce(
        new Response(
          createBhadooReverseEnvelope({
            nextPageToken: null,
            curPageIndex: 0,
            data: {
              files: [
                {
                  id: "wrapped-file",
                  name: "wrapped-video.mkv",
                  mimeType: "video/x-matroska",
                  link: "/download.aspx?file=wrapped",
                },
              ],
            },
          })
        )
      )

    const result = await extractBhadooGoogleDriveIndex({
      request: {
        input: { kind: "source", sourceUrl: "https://drive.example/0:/" },
        basicAuth: { username: "viewer", password: "secret" },
      },
      targetUrl: "https://drive.example/0:/",
      plugin,
      publicAssetOrigin: "https://lynvo.example",
    })

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({
      headers: { Authorization: `Basic ${btoa("viewer:secret")}` },
    })
    expect(fetchSpy.mock.calls[1]?.[1]).toMatchObject({
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Authorization: `Basic ${btoa("viewer:secret")}`,
      },
      body: "password=&page_token=&page_index=0",
    })
    expect(result.nodes).toMatchObject([
      { kind: "playable", label: "wrapped-video.mkv" },
    ])
  })

  it("treats a trailing-slash video filename as an index folder", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({
        nextPageToken: null,
        curPageIndex: 0,
        data: {
          files: [
            {
              id: "nested-folder",
              name: "Real files",
              mimeType: "application/vnd.google-apps.folder",
            },
          ],
        },
      })
    )

    const result = await extractBhadooGoogleDriveIndex({
      request: {
        input: {
          kind: "source",
          sourceUrl: "https://drive.example/0:/fake-video.mkv/",
        },
      },
      targetUrl: "https://drive.example/0:/fake-video.mkv/",
      plugin,
      publicAssetOrigin: "https://lynvo.example",
    })

    expect(result.nodes).toMatchObject([
      {
        kind: "resolvable",
        label: "Real files",
        resolutionKind: "folder",
      },
    ])
  })

  it("rejects a repeated Bhadoo continuation token", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({
        nextPageToken: "repeated-token",
        curPageIndex: 0,
        data: { files: [] },
      })
    )

    await expect(
      extractBhadooGoogleDriveIndex({
        request: {
          input: { kind: "source", sourceUrl: "https://drive.example/0:/" },
        },
        targetUrl: "https://drive.example/0:/",
        plugin,
        publicAssetOrigin: "https://lynvo.example",
      })
    ).rejects.toThrow("repeated a continuation token")
  })
})

describe("OneDrive source adapter", () => {
  const plugin = LYNVO_PLUGIN_CATALOG[2]

  it("maps folders and video files while skipping unrelated files", () => {
    const nodes = createOneDriveNodes(
      [
        { id: "folder-1", name: "Folder 1", folder: {} },
        {
          id: "file-1",
          name: "playable-item.mp4",
          file: {},
          size: 203059200,
        },
        { id: "image-1", name: "cover.jpg", file: {} },
      ],
      "/Collections",
      "https://index.example",
      "token"
    )
    expect(nodes).toMatchObject([
      {
        kind: "resolvable",
        label: "Folder 1",
        resolutionKind: "folder",
      },
      { kind: "playable", label: "playable-item.mp4", size: "193.65 MB" },
    ])
  })

  it("extracts Next.js page data and forwards a hashed Plugin Domain password", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        '<script id="__NEXT_DATA__" type="application/json">' +
          JSON.stringify({
            props: {
              pageProps: {
                folder: {
                  value: [
                    { id: "file-1", name: "playable-item.mp4", file: {} },
                  ],
                },
              },
            },
          }) +
          "</script>"
      )
    )
    const result = await extractOneDriveIndex({
      request: {
        input: {
          kind: "source",
          sourceUrl: "https://index.example/Collections",
        },
        password: "domain-password",
      },
      targetUrl: "https://index.example/Collections",
      plugin,
      publicAssetOrigin: "https://lynvo.example",
    })
    expect(result.nodes).toMatchObject([{ kind: "playable" }])
    expect(fetchSpy.mock.calls[0][1]?.headers).toHaveProperty(
      "od-protected-token"
    )
  })

  it("continues the pagination token embedded in the initial page", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          '<script id="__NEXT_DATA__" type="application/json">' +
            JSON.stringify({
              props: {
                pageProps: {
                  folder: { value: [] },
                  next: "initial-continuation",
                },
              },
            }) +
            "</script>"
        )
      )
      .mockResolvedValueOnce(
        Response.json({
          folder: {
            value: [{ id: "continued", name: "continued.mp4", file: {} }],
          },
        })
      )

    const result = await extractOneDriveIndex({
      request: {
        input: {
          kind: "source",
          sourceUrl: "https://index.example/Collections",
        },
      },
      targetUrl: "https://index.example/Collections",
      plugin,
      publicAssetOrigin: "https://lynvo.example",
    })

    expect(result.nodes).toMatchObject([{ label: "continued.mp4" }])
    expect(String(fetchSpy.mock.calls[1][0])).toContain(
      "next=initial-continuation"
    )
  })

  it("rejects oversized upstream response bodies", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response("oversized", {
          headers: { "Content-Length": String(2 * 1024 * 1024 + 1) },
        })
    )

    await expect(
      extractOneDriveIndex({
        request: {
          input: {
            kind: "source",
            sourceUrl: "https://index.example/Collections",
          },
        },
        targetUrl: "https://index.example/Collections",
        plugin,
        publicAssetOrigin: "https://lynvo.example",
      })
    ).rejects.toThrow("response exceeded its byte limit")
  })

  it("validates every redirect before following it", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(null, {
          status: 302,
          headers: { Location: "http://127.0.0.1/private" },
        })
    )

    await expect(
      extractOneDriveIndex({
        request: {
          input: {
            kind: "source",
            sourceUrl: "https://index.example/Collections",
          },
        },
        targetUrl: "https://index.example/Collections",
        plugin,
        publicAssetOrigin: "https://lynvo.example",
      })
    ).rejects.toThrow()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][1]?.redirect).toBe("manual")
  })
})

describe("Google Drive public files source adapter", () => {
  const plugin = LYNVO_PLUGIN_CATALOG[1]
  const folderItem = [
    "folder-id",
    ["parent-id"],
    "Nested folder",
    "application/vnd.google-apps.folder",
  ]
  const videoItem = [
    "video-id",
    ["parent-id"],
    "Root video.mkv",
    "video/x-matroska",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    1105713,
  ]
  const unrelatedItem = [
    "document-id",
    ["parent-id"],
    "Notes.txt",
    "text/plain",
  ]

  const createFolderHtml = (): string => {
    const payload = JSON.stringify([[folderItem, videoItem, unrelatedItem]])
      .split("")
      .map(
        (character) =>
          `\\x${character.charCodeAt(0).toString(16).padStart(2, "0")}`
      )
      .join("")
    return `<title>Public tests – Google Drive</title><script>window['_DRIVE_ivd'] = '${payload}';</script>`
  }

  it("extracts a file ID and creates the direct download URL", () => {
    const fileId = extractGoogleDriveFileId(
      "https://drive.google.com/file/d/1AbCdEfGh123/view?usp=sharing"
    )

    expect(fileId).toBe("1AbCdEfGh123")
    expect(createGoogleDriveDownloadUrl(fileId)).toBe(
      "https://drive.usercontent.google.com/download?id=1AbCdEfGh123&export=download&confirm=t"
    )
  })

  it("rejects folder links and lookalike domains", () => {
    expect(() =>
      extractGoogleDriveFileId(
        "https://drive.google.com/drive/folders/1AbCdEfGh123"
      )
    ).toThrow(ProtocolError)
    expect(() =>
      extractGoogleDriveFileId(
        "https://drive.google.com.example/file/d/1AbCdEfGh123/view"
      )
    ).toThrow(ProtocolError)
  })

  it("parses public folders into lazy folders and playable root files", () => {
    expect(
      extractGoogleDriveFolderId(
        "https://drive.google.com/drive/folders/folder-id?usp=sharing"
      )
    ).toBe("folder-id")

    const items = parseGoogleDrivePublicFolderItems(createFolderHtml())
    expect(createGoogleDrivePublicFolderNodes(items)).toEqual([
      {
        kind: "resolvable",
        id: "folder-id",
        label: "Nested folder",
        nodeUrl: "https://drive.google.com/drive/folders/folder-id",
        resolutionKind: "folder",
      },
      {
        kind: "playable",
        id: "video-id",
        label: "Root video.mkv",
        url: "https://drive.usercontent.google.com/download?id=video-id&export=download&confirm=t",
        size: "1.05 MB",
        status: "unknown",
      },
    ])
  })

  it("extracts a public folder page without Google authentication", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(createFolderHtml(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    )

    const result = await extractGoogleDrivePublicFolder({
      request: {
        input: {
          kind: "source",
          sourceUrl: "https://drive.google.com/drive/folders/parent-id",
        },
      },
      targetUrl: "https://drive.google.com/drive/folders/parent-id",
      plugin,
      publicAssetOrigin: "https://lynvo.example",
    })

    expect(result.plugin.pageTitle).toBe("Public tests")
    expect(result.nodes).toHaveLength(2)
  })

  it("rejects folder pages without the public listing payload", () => {
    expect(() =>
      parseGoogleDrivePublicFolderItems("<html>Sign in</html>")
    ).toThrow("Google Drive folder is not publicly accessible.")
  })

  it("returns one playable direct-download node", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([0]), {
        status: 206,
        headers: {
          "Content-Disposition": 'attachment; filename="example-video.mkv"',
          "Content-Range": "bytes 0-0/1105713",
        },
      })
    )
    const result = await extractGoogleDrivePublicFile({
      request: {
        input: {
          kind: "source",
          sourceUrl:
            "https://drive.google.com/file/d/1AbCdEfGh123/view?usp=sharing",
        },
      },
      targetUrl:
        "https://drive.google.com/file/d/1AbCdEfGh123/view?usp=sharing",
      plugin,
      publicAssetOrigin: "https://lynvo.example",
    })

    expect(result.nodes).toEqual([
      {
        kind: "playable",
        id: "1AbCdEfGh123",
        label: "example-video.mkv",
        url: "https://drive.usercontent.google.com/download?id=1AbCdEfGh123&export=download&confirm=t",
        size: "1.05 MB",
        status: "unknown",
      },
    ])
  })

  it("preserves a Drive resource key in the download URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([0]), {
        status: 206,
        headers: {
          "Content-Disposition":
            'attachment; filename="resource-key-video.m2ts"',
          "Content-Range": "bytes 0-0/203059200",
        },
      })
    )

    const result = await extractGoogleDrivePublicFile({
      request: {
        input: {
          kind: "source",
          sourceUrl:
            "https://drive.google.com/file/d/resource-key-file-id/view?resourcekey=0-example-key",
        },
      },
      targetUrl:
        "https://drive.google.com/file/d/resource-key-file-id/view?resourcekey=0-example-key",
      plugin,
      publicAssetOrigin: "https://lynvo.example",
    })

    const expectedUrl =
      "https://drive.usercontent.google.com/download?id=resource-key-file-id&export=download&confirm=t&resourcekey=0-example-key"
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(expectedUrl)
    expect(result.nodes[0]).toMatchObject({
      url: expectedUrl,
      size: "193.65 MB",
    })
  })

  it("classifies an HTML download response as Google Drive rate limiting", async () => {
    const response = new Response("<html>quota exceeded</html>", {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
    if (!response.body) {
      throw new Error("Expected the test response to have a body.")
    }
    const cancel = vi.spyOn(response.body, "cancel")
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response)

    await expect(
      fetchGoogleDrivePublicFileMetadata(
        "https://drive.usercontent.google.com/download?id=file-id"
      )
    ).rejects.toThrow(
      "Google Drive file is rate-limited. Try again in 24 hours."
    )
    expect(cancel).toHaveBeenCalledOnce()
  })

  it("does not mistake a partial response length for the Drive file size", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([0]), {
        status: 206,
        headers: {
          "Content-Disposition": 'attachment; filename="example-video.mkv"',
          "Content-Length": "1",
          "Content-Range": "bytes 0-0/*",
        },
      })
    )

    await expect(
      fetchGoogleDrivePublicFileMetadata(
        "https://drive.usercontent.google.com/download?id=file-id"
      )
    ).resolves.toEqual({ filename: "example-video.mkv" })
  })
})

import { afterEach, describe, expect, it, vi } from "vitest"
import { GoogleDriveIcon } from "@hugeicons/core-free-icons"
import { officialPlugins } from "~/features/site/settings/plugin-settings-data"
import { bhadooGoogleDriveIndexPlugin } from "~/lib/plugins/bhadoo-google-drive-index"
import {
  createBhadooFileLink,
  decodeLegacyBhadooResponse,
  extractBhadooGoogleDriveIndex,
  formatBhadooFileSize,
  processBhadooItems,
} from "~/lib/plugins/bhadoo-google-drive-index-extractor"

describe("Bhadoo Google Drive Index", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("formats the byte size returned by the index", () => {
    expect(formatBhadooFileSize("492077810")).toBe("469.28 MB")
  })

  it("decodes legacy Bhadoo list responses", () => {
    const response = JSON.stringify({
      nextPageToken: null,
      curPageIndex: 0,
      data: { files: [] },
    })
    const encodedResponse = `${"suffix".padEnd(20, "-")}${btoa(response)
      .split("")
      .reverse()
      .join("")}${"prefix".padEnd(24, "-")}`

    expect(decodeLegacyBhadooResponse(encodedResponse)).toEqual(
      JSON.parse(response)
    )
  })

  it("is registered as an official domain-managed plugin", () => {
    const settingsPlugin = officialPlugins.find(
      (plugin) => plugin.id === bhadooGoogleDriveIndexPlugin.id
    )

    expect(settingsPlugin).toEqual(
      expect.objectContaining({
        name: "Bhadoo’s Google Drive Index",
        sourceUrl: "https://gitlab.com/GoogleDriveIndex/Google-Drive-Index",
        icon: { hugeIcon: GoogleDriveIcon },
        supportsDomains: true,
      })
    )
    expect(settingsPlugin?.credentialKind).toBe("http-basic")
    expect(bhadooGoogleDriveIndexPlugin.credential).toEqual({
      pluginId: "bhadoo-google-drive-index",
      kind: "http-basic",
    })
    expect(bhadooGoogleDriveIndexPlugin.descriptionUrl).toBe(
      "https://gitlab.com/GoogleDriveIndex/Google-Drive-Index"
    )
  })

  it("creates absolute signed download links", () => {
    const link = createBhadooFileLink(
      {
        id: "file-1",
        name: "Summer.Strike.S01E01.mkv",
        mimeType: "video/x-matroska",
        size: "492077810",
        link: "/download.aspx?file=signed-file&expiry=signed-expiry",
      },
      "https://gd.example.com"
    )

    expect(link).toEqual({
      id: "file-1",
      type: "file",
      label: "Summer.Strike.S01E01.mkv",
      url: "https://gd.example.com/download.aspx?file=signed-file&expiry=signed-expiry",
      size: "469.28 MB",
    })
  })

  it("creates legacy direct links when list items omit the link field", () => {
    const link = createBhadooFileLink(
      {
        id: "file-1",
        name: "Mission Impossible (1996) [Hindi + English].mkv",
        mimeType: "video/x-matroska",
        size: "3608649615",
      },
      "https://allinone:strange%40115@index.example.com/0:/Movies/"
    )

    expect(link?.url).toBe(
      "https://allinone:strange%40115@index.example.com/0:/Movies/Mission%20Impossible%20(1996)%20[Hindi%20+%20English].mkv"
    )
  })

  it("returns an authenticated direct media URL without requesting a folder listing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const directUrl =
      "https://allinone:strange%40115@index.example.com/0:/Movies/300%20(2006).mkv"

    await expect(extractBhadooGoogleDriveIndex(directUrl)).resolves.toEqual([
      {
        type: "file",
        label: "300 (2006).mkv",
        url: directUrl,
      },
    ])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("removes the Bhadoo view parameter from direct media links", async () => {
    const inputUrl =
      "https://allinone:strange%40115@index.example.com/0:/Movies/300%20(2006).mkv?a=view"

    await expect(extractBhadooGoogleDriveIndex(inputUrl)).resolves.toEqual([
      expect.objectContaining({
        url: "https://allinone:strange%40115@index.example.com/0:/Movies/300%20(2006).mkv",
      }),
    ])
  })

  it("creates folder links and excludes non-video files", () => {
    const links = processBhadooItems(
      [
        {
          id: "folder-1",
          name: "Summer Strike",
          mimeType: "application/vnd.google-apps.folder",
          link: null,
        },
        {
          id: "image-1",
          name: "poster.jpg",
          mimeType: "image/jpeg",
          link: "/download.aspx?file=image",
        },
      ],
      new URL("https://gd.example.com/0:/K-DRAMA%20/")
    )

    expect(links).toEqual([
      expect.objectContaining({
        id: "folder-1",
        type: "folder",
        label: "Summer Strike",
        url: "https://gd.example.com/0:/K-DRAMA%20/Summer%20Strike/",
      }),
    ])
  })

  it("requests every API page and preserves its signed links", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          nextPageToken: "next-page",
          curPageIndex: 0,
          data: {
            files: [
              {
                id: "file-1",
                name: "episode-1.mkv",
                mimeType: "video/x-matroska",
                link: "/download.aspx?file=one",
              },
            ],
          },
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          nextPageToken: null,
          curPageIndex: 1,
          data: {
            files: [
              {
                id: "file-2",
                name: "episode-2.mp4",
                mimeType: "video/mp4",
                link: "/download.aspx?file=two",
              },
            ],
          },
        })
      )

    const links = await extractBhadooGoogleDriveIndex(
      "https://viewer:s%40fe@gd.example.com/0:/Shows/"
    )

    expect(links.map((link) => link.label)).toEqual([
      "episode-1.mkv",
      "episode-2.mp4",
    ])
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      new URL("https://gd.example.com/0:/Shows/"),
      expect.objectContaining({
        body: JSON.stringify({
          password: "",
          page_token: "next-page",
          page_index: 1,
        }),
        headers: expect.objectContaining({
          Authorization: `Basic ${btoa("viewer:s@fe")}`,
        }),
      })
    )
  })

  it("preserves Basic Auth userinfo in generated folder and download links", () => {
    const links = processBhadooItems(
      [
        {
          id: "folder-1",
          name: "Season 1",
          mimeType: "application/vnd.google-apps.folder",
          link: null,
        },
        {
          id: "file-1",
          name: "episode.mkv",
          mimeType: "video/x-matroska",
          link: "/download.aspx?file=signed",
        },
      ],
      new URL("https://viewer:secret@gd.example.com/0:/Shows/")
    )

    expect(links[0].url).toBe(
      "https://viewer:secret@gd.example.com/0:/Shows/Season%201/"
    )
    expect(links[1].url).toBe(
      "https://viewer:secret@gd.example.com/download.aspx?file=signed"
    )
  })

  it("uses Basic Auth for metadata fetches without passing URL userinfo to fetch", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("<title>Private Index</title>"))

    await bhadooGoogleDriveIndexPlugin.fetch?.(
      "https://viewer:s%40fe@gd.example.com/0:/Shows/"
    )

    expect(fetchSpy).toHaveBeenCalledWith(
      new URL("https://gd.example.com/0:/Shows/"),
      {
        headers: { Authorization: `Basic ${btoa("viewer:s@fe")}` },
      }
    )
  })

  it("uses an authenticated HEAD request for direct media metadata", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }))

    await bhadooGoogleDriveIndexPlugin.fetch?.(
      "https://viewer:s%40fe@gd.example.com/0:/Shows/episode.mkv"
    )

    expect(fetchSpy).toHaveBeenCalledWith(
      new URL("https://gd.example.com/0:/Shows/episode.mkv"),
      {
        method: "HEAD",
        headers: { Authorization: `Basic ${btoa("viewer:s@fe")}` },
      }
    )
  })

  it("detects the Bhadoo package namespace without relying on the page title", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        '<title>Custom Index Name</title><script src="https://cdn.jsdelivr.net/npm/@googledrive/index@2.5.9/src/app.min.js"></script>'
      )
    )

    await expect(
      bhadooGoogleDriveIndexPlugin.canHandle("https://gd.example.com/0:/Shows/")
    ).resolves.toBe(true)
  })

  it("rejects generic Google Drive Index pages without the Bhadoo package namespace", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<title>Google Drive Index</title>")
    )

    await expect(
      bhadooGoogleDriveIndexPlugin.canHandle("https://gd.example.com/0:/Shows/")
    ).resolves.toBe(false)
  })

  it("detects legacy Bhadoo CDN deployments", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        '<script src="https://cdn.jsdelivr.net/gh/rokibhasansagar/BhadooGDIndex@2.2.3/js/app.min.js"></script>'
      )
    )

    await expect(
      bhadooGoogleDriveIndexPlugin.canHandle("https://gd.example.com/0:/")
    ).resolves.toBe(true)
  })

  it("detects customized legacy deployments containing the Bhadoo name", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('<meta name="generator" content="Bhadoo Drive Index">')
    )

    await expect(
      bhadooGoogleDriveIndexPlugin.canHandle("https://gd.example.com/0:/")
    ).resolves.toBe(true)
  })
})

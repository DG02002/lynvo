import { afterEach, describe, expect, it, vi } from "vitest"
import { officialPlugins } from "~/features/site/settings/plugin-settings-data"
import { getPluginForUrl } from "~/lib/plugins"
import {
  createOneDriveFileLink,
  encodeOneDrivePath,
  isVideoFile,
  processOneDriveItems,
  onedriveIndexPlugin,
  type OneDriveItem,
} from "~/lib/plugins/onedrive-index"

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("OneDrive Index detection", () => {
  it("uses the upstream project name and source URL", () => {
    const settingsPlugin = officialPlugins.find(
      (plugin) => plugin.id === onedriveIndexPlugin.id
    )

    expect(onedriveIndexPlugin.name).toBe("Spencerwooo's Onedrive Vercel Index")
    expect(onedriveIndexPlugin.descriptionUrl).toBe(
      "https://github.com/spencerwooo/onedrive-vercel-index"
    )
    expect(settingsPlugin).toEqual(
      expect.objectContaining({
        name: "Spencerwooo's Onedrive Vercel Index",
        sourceUrl: "https://github.com/spencerwooo/onedrive-vercel-index",
      })
    )
  })

  it("does not fall back to Direct Link when a OneDrive page responds after 1.5 seconds", async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init) =>
        await new Promise<Response>((resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted", "AbortError"))
          )
          setTimeout(
            () =>
              resolve(
                new Response(
                  '<html><meta name="description" content="OneDrive Vercel Index"></html>'
                )
              ),
            1600
          )
        })
    )

    const pluginPromise = getPluginForUrl("https://index.example.com/")
    await vi.advanceTimersByTimeAsync(1600)

    await expect(pluginPromise).resolves.toEqual(
      expect.objectContaining({ id: "onedrive-index" })
    )
  })

  it("detects the repository slug in the Next.js page payload", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          '<script id="__NEXT_DATA__" type="application/json">{"message":"Welcome to your new onedrive-vercel-index"}</script>'
        )
    )

    await expect(
      getPluginForUrl("https://index.example.com/")
    ).resolves.toEqual(expect.objectContaining({ id: "onedrive-index" }))
  })

  it("rejects generic pages that only mention OneDrive in the title", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response("<html><title>Using OneDrive at Acme</title></html>")
    )

    await expect(
      getPluginForUrl("https://example.com/onedrive-guide")
    ).resolves.toEqual(expect.objectContaining({ id: "direct-link" }))
  })

  it("does not identify an arbitrary unauthorized page as OneDrive Index", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response("Unauthorized", { status: 401 })
    )

    await expect(
      getPluginForUrl("https://private.example.com/")
    ).resolves.toEqual(expect.objectContaining({ id: "direct-link" }))
  })
})

describe("isVideoFile", () => {
  it("accepts common video extensions", () => {
    expect(isVideoFile("movie.mp4")).toBe(true)
    expect(isVideoFile("show.mkv")).toBe(true)
  })

  it("rejects non-video extensions", () => {
    expect(isVideoFile("cover.jpg")).toBe(false)
    expect(isVideoFile("subtitle.srt")).toBe(false)
  })
})

describe("createOneDriveFileLink", () => {
  it("preserves the password token in generated raw URLs", () => {
    const item: OneDriveItem = { name: "movie.mp4", id: "file-1", file: {} }
    const link = createOneDriveFileLink(
      item,
      "/movies",
      "https://index.example.com",
      "hashed-password-token"
    )

    expect(link.url).toContain("path=%2Fmovies%2Fmovie.mp4")
    expect(link.url).toContain("odpt=hashed-password-token")
    expect(link.type).toBe("file")
  })
})

describe("encodeOneDrivePath", () => {
  it("encodes each path segment without encoding separators", () => {
    expect(encodeOneDrivePath("/happy/Show S01 DD+5.1/part #1.mkv")).toBe(
      "/happy/Show%20S01%20DD%2B5.1/part%20%231.mkv"
    )
  })
})

describe("processOneDriveItems", () => {
  it("creates lazy folders without recursively fetching their contents", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const items: OneDriveItem[] = [
      { name: "Season 1", id: "folder-1", folder: {} },
      { name: "trailer.mp4", id: "file-2", file: {} },
    ]

    const result = await processOneDriveItems(
      items,
      "/",
      "https://index.example.com",
      ""
    )

    expect(result).toHaveLength(2)

    const folder = result.find((link) => link.type === "folder")
    expect(folder).toBeDefined()
    expect(folder?.label).toBe("Season 1")
    expect(folder?.children).toEqual([])
    expect(folder?.childrenResolved).toBe(false)
    expect(folder?.url).toBe("https://index.example.com/Season%201")
    expect(fetchSpy).not.toHaveBeenCalled()

    const directFile = result.find((link) => link.type === "file")
    expect(directFile?.label).toBe("trailer.mp4")
  })

  it("creates encoded folder URLs for paths containing spaces and plus signs", async () => {
    const items: OneDriveItem[] = [
      { name: "Show S01 DD+5.1", id: "folder-1", folder: {} },
    ]

    const result = await processOneDriveItems(
      items,
      "/happy",
      "https://index.example.com",
      ""
    )

    expect(result[0].url).toBe(
      "https://index.example.com/happy/Show%20S01%20DD%2B5.1"
    )
  })

  it("creates a single direct file for a raw file item", async () => {
    const items: OneDriveItem[] = [
      { name: "movie.mp4", id: "file-1", file: {} },
    ]

    const result = await processOneDriveItems(
      items,
      "/",
      "https://index.example.com",
      "token"
    )

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("file")
    expect(result[0].label).toBe("movie.mp4")
    expect(result[0].url).toContain("odpt=token")
  })

  it("skips non-video files", async () => {
    const items: OneDriveItem[] = [
      { name: "cover.jpg", id: "file-1", file: {} },
      { name: "movie.mp4", id: "file-2", file: {} },
    ]

    const result = await processOneDriveItems(
      items,
      "/",
      "https://index.example.com",
      ""
    )

    expect(result).toHaveLength(1)
    expect(result[0].label).toBe("movie.mp4")
  })
})

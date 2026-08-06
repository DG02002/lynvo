import { afterEach, describe, expect, it, vi } from "vitest"
import { directMediaAdapter } from "~/lib/plugins/direct-media-adapter"

const response = (status: number, contentType = "video/mp4") =>
  new Response(null, {
    status,
    headers: {
      "content-type": contentType,
      "content-disposition": 'attachment; filename="playable-item.mp4"',
      ...(status === 206 ? { "content-range": "bytes 0-0/100" } : {}),
    },
  })

describe("directMediaAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("marks Direct Media links as range-supported when byte range returns 206", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(206))

    const links = await directMediaAdapter.extract(
      "https://cdn.example.com/playable-item.mp4"
    )

    expect(links).toEqual([
      expect.objectContaining({
        url: "https://cdn.example.com/playable-item.mp4",
        label: "playable-item.mp4",
        status: "up",
        rangeRequest: "supported",
      }),
    ])
  })

  it("cancels the probe body instead of buffering media", async () => {
    const probeResponse = new Response("probe body", {
      status: 206,
      headers: {
        "content-type": "video/mp4",
        "content-disposition": 'attachment; filename="playable-item.mp4"',
        "content-range": "bytes 0-0/100",
      },
    })
    const arrayBufferSpy = vi.spyOn(probeResponse, "arrayBuffer")
    vi.spyOn(globalThis, "fetch").mockResolvedValue(probeResponse)

    await directMediaAdapter.extract(
      "https://cdn.example.com/playable-item.mp4"
    )

    expect(arrayBufferSpy).not.toHaveBeenCalled()
  })

  it("keeps Direct Media links when byte range returns 200 and marks them unsupported", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(200))

    const links = await directMediaAdapter.extract(
      "https://cdn.example.com/playable-item.mp4"
    )

    expect(links[0]).toEqual(
      expect.objectContaining({
        url: "https://cdn.example.com/playable-item.mp4",
        label: "playable-item.mp4",
        status: "up",
        rangeRequest: "unsupported",
      })
    )
  })

  it("does not treat Google cache revalidation headers as link expiry", async () => {
    const cacheTimestamp = "Thu, 06 Aug 2026 16:57:51 GMT"
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: {
          "cache-control": "private, max-age=0",
          "content-disposition": 'attachment; filename="google-video.mkv"',
          "content-type": "video/mkv",
          date: cacheTimestamp,
          expires: cacheTimestamp,
        },
      })
    )

    const links = await directMediaAdapter.extract(
      "https://video-downloads.googleusercontent.com/google-token"
    )

    expect(links[0]).toMatchObject({
      status: "up",
      rangeRequest: "unsupported",
    })
    expect(links[0]).not.toHaveProperty("expiry")
    expect(links[0]).not.toHaveProperty("expirySource")
  })

  it("rejects non-video Direct Media URLs", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(200, "text/html"))

    await expect(
      directMediaAdapter.extract("https://cdn.example.com/page")
    ).rejects.toThrow("supported video format")
  })

  it("rejects unsupported file extensions before fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    await expect(
      directMediaAdapter.extract("https://cdn.example.com/archive.zip")
    ).rejects.toThrow("file type")
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("accepts extensionless signed URLs using their response filename", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 206,
        headers: {
          "content-type": "application/octet-stream",
          "content-disposition": 'attachment; filename="signed-video.mkv"',
          "content-range": "bytes 0-0/100",
          date: "Thu, 06 Aug 2026 11:01:20 GMT",
          "cache-control": "public, max-age=604800",
        },
      })
    )

    const links = await directMediaAdapter.extract(
      "https://r2.example/object?X-Amz-Date=20260806T110120Z&X-Amz-Expires=28800"
    )

    expect(links[0]).toMatchObject({
      label: "signed-video.mkv",
      status: "up",
      rangeRequest: "supported",
      expiry: Date.parse("2026-08-06T19:01:20Z"),
      expirySource: "signed-url",
    })
  })
})

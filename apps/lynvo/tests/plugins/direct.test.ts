import { afterEach, describe, expect, it, vi } from "vitest"
import { directMediaAdapter } from "~/lib/plugins/direct-media-adapter"

const response = (status: number, contentType = "video/mp4") =>
  new Response(null, {
    status,
    headers: {
      "content-type": contentType,
      "content-disposition": 'attachment; filename="playable-item.mp4"',
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
        rangeRequest: "supported",
      }),
    ])
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
        rangeRequest: "unsupported",
      })
    )
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
})

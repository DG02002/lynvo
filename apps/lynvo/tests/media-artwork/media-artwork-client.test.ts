import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  MEDIA_ARTWORK_CACHE_STORAGE_PREFIX,
  MEDIA_ARTWORK_FLUSH_DELAY_MS,
} from "~/lib/constants"
import { createMemoryStorage } from "../memory-storage"

const importMediaArtworkClient = async () => {
  vi.resetModules()
  return await import("~/features/links/media-artwork/media-artwork-client")
}

const flushArtworkRequests = async () => {
  await vi.advanceTimersByTimeAsync(MEDIA_ARTWORK_FLUSH_DELAY_MS)
}

const artworkRequest: MediaArtworkRequest = {
  mediaKind: "movie",
  title: "Ghost in the Shell",
  year: 2017,
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage())
  vi.useFakeTimers()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("media artwork client cache", () => {
  it("serves repeat lookups from local storage after a reload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ results: [{ posterPath: "/poster.jpg" }] }),
        {
          headers: { "Content-Type": "application/json" },
        }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    const client = await importMediaArtworkClient()
    const artworkKey = client.getMediaArtworkKey(artworkRequest)
    client.requestMediaArtwork(artworkKey, artworkRequest)
    await flushArtworkRequests()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(client.getMediaArtworkForKey(artworkKey)).toEqual({
      posterPath: "/poster.jpg",
    })
    expect(
      localStorage.getItem(MEDIA_ARTWORK_CACHE_STORAGE_PREFIX + artworkKey)
    ).toContain("/poster.jpg")

    const reloadedClient = await importMediaArtworkClient()
    reloadedClient.requestMediaArtwork(artworkKey, artworkRequest)
    await flushArtworkRequests()

    expect(reloadedClient.getMediaArtworkForKey(artworkKey)).toEqual({
      posterPath: "/poster.jpg",
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it("refetches entries whose cache lifetime has expired", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [{}] }), {
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const client = await importMediaArtworkClient()
    const artworkKey = client.getMediaArtworkKey(artworkRequest)
    localStorage.setItem(
      MEDIA_ARTWORK_CACHE_STORAGE_PREFIX + artworkKey,
      JSON.stringify({
        value: { posterPath: "/stale.jpg" },
        expiresAt: Date.now() - 1,
      })
    )

    client.requestMediaArtwork(artworkKey, artworkRequest)
    await flushArtworkRequests()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(client.getMediaArtworkForKey(artworkKey)).toEqual({})
    expect(
      localStorage.getItem(MEDIA_ARTWORK_CACHE_STORAGE_PREFIX + artworkKey)
    ).not.toContain("/stale.jpg")
  })

  it("does not persist transient lookup failures", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"))
    vi.stubGlobal("fetch", fetchMock)

    const client = await importMediaArtworkClient()
    const artworkKey = client.getMediaArtworkKey(artworkRequest)
    client.requestMediaArtwork(artworkKey, artworkRequest)
    await flushArtworkRequests()

    expect(client.getMediaArtworkForKey(artworkKey)).toBeUndefined()
    expect(
      localStorage.getItem(MEDIA_ARTWORK_CACHE_STORAGE_PREFIX + artworkKey)
    ).toBeNull()

    const reloadedClient = await importMediaArtworkClient()
    reloadedClient.requestMediaArtwork(artworkKey, artworkRequest)
    await flushArtworkRequests()

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

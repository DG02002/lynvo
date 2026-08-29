import { describe, expect, it, vi } from "vitest"
import { lookupMediaArtworkCached } from "../../workers/media-metadata/artwork-cache"

const TMDB_TOKEN = "test-token"

const createTmdbFetch = () =>
  vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
      new Response(
        JSON.stringify({
          results: [
            { id: 42, title: "Cache Test", poster_path: "/poster.jpg" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
  )

const createFailingTmdbFetch = () =>
  vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
      new Response("upstream unavailable", { status: 502 })
  )

describe("media artwork cache", () => {
  it("serves repeat lookups from the cache instead of TMDB", async () => {
    const fetchMock = createTmdbFetch()
    const dependencies = {
      waitUntil: () => {},
      fetch: fetchMock,
    }
    const requests = [{ title: "Cache Test", mediaKind: "movie" as const }]
    const first = await lookupMediaArtworkCached(
      { TMDB_API_READ_ACCESS_TOKEN: TMDB_TOKEN },
      requests,
      dependencies
    )
    expect(first).toEqual([
      {
        posterPath: "/poster.jpg",
        identity: { providerId: 42, title: "Cache Test" },
        candidates: [{ providerId: 42, title: "Cache Test" }],
      },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.waitFor(async () => {
      const cached = await globalThis.caches?.default.match(
        await (async () => {
          const digest = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(
              JSON.stringify(["cache test", "movie", null, null, null])
            )
          )
          return `https://lynvo-tmdb-artwork-cache.internal/${[
            ...new Uint8Array(digest),
          ]
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("")}.json`
        })()
      )
      expect(cached).toBeDefined()
    })

    const second = await lookupMediaArtworkCached(
      { TMDB_API_READ_ACCESS_TOKEN: TMDB_TOKEN },
      requests,
      dependencies
    )
    expect(second).toEqual([
      {
        posterPath: "/poster.jpg",
        identity: { providerId: 42, title: "Cache Test" },
        candidates: [{ providerId: 42, title: "Cache Test" }],
      },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not cache transient upstream failures", async () => {
    const fetchMock = createFailingTmdbFetch()
    const dependencies = {
      waitUntil: () => {},
      fetch: fetchMock,
    }
    const requests = [{ title: "Failure Test", mediaKind: "movie" as const }]
    const first = await lookupMediaArtworkCached(
      { TMDB_API_READ_ACCESS_TOKEN: TMDB_TOKEN },
      requests,
      dependencies
    )
    const second = await lookupMediaArtworkCached(
      { TMDB_API_READ_ACCESS_TOKEN: TMDB_TOKEN },
      requests,
      dependencies
    )
    expect(first).toEqual([{}])
    expect(second).toEqual([{}])
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1)
  })
})

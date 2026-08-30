import { describe, expect, it, vi } from "vitest"
import { MEDIA_ARTWORK_CACHE_VERSION } from "../../app/lib/constants"
import { lookupMediaArtworkCached } from "../../workers/media-metadata/artwork-cache"

const TMDB_TOKEN = "test-token"

interface TmdbFixturePayloadItem {
  readonly id?: number
  readonly title?: string
  readonly poster_path?: string | null
}

interface TmdbFixturePayload {
  readonly id?: number
  readonly title?: string
  readonly poster_path?: string | null
  readonly results?: readonly TmdbFixturePayloadItem[]
}

const jsonResponse = (payload: TmdbFixturePayload): Response =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  })

const createTmdbFetch = () =>
  vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const requestUrl = String(input)
    if (requestUrl.includes("/movie/42")) {
      return jsonResponse({
        id: 42,
        title: "Cache Test",
        poster_path: "/poster.jpg",
      })
    }
    return jsonResponse({
      results: [{ id: 42, title: "Cache Test", poster_path: "/poster.jpg" }],
    })
  })

const createFailingTmdbFetch = () =>
  vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
      new Response("upstream unavailable", { status: 502 })
  )

const expectedCandidate = {
  providerId: 42,
  title: "Cache Test",
  mediaKind: "movie" as const,
  posterPath: "/poster.jpg",
}

const getArtworkCacheUrl = async (
  canonicalRequest: readonly unknown[],
  cacheVersion?: number
) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(canonicalRequest))
  )
  const cacheKey = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
  const versionPath = cacheVersion === undefined ? "" : `v${cacheVersion}/`
  return `https://lynvo-tmdb-artwork-cache.internal/${versionPath}${cacheKey}.json`
}

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
        candidates: [expectedCandidate],
      },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.waitFor(async () => {
      const cached = await globalThis.caches?.default.match(
        await getArtworkCacheUrl(
          ["cache test", "movie", null, null, null, null],
          MEDIA_ARTWORK_CACHE_VERSION
        )
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
        candidates: [expectedCandidate],
      },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not serve a stored provider-id lookup from the title lookup's cache entry", async () => {
    const fetchMock = createTmdbFetch()
    const dependencies = {
      waitUntil: () => {},
      fetch: fetchMock,
    }
    const titleRequest = { title: "Cache Test", mediaKind: "movie" as const }
    await lookupMediaArtworkCached(
      { TMDB_API_READ_ACCESS_TOKEN: TMDB_TOKEN },
      [titleRequest],
      dependencies
    )

    const byId = await lookupMediaArtworkCached(
      { TMDB_API_READ_ACCESS_TOKEN: TMDB_TOKEN },
      [{ ...titleRequest, providerId: 42 }],
      dependencies
    )
    // Without the id in the cache key, the id-based request would reuse the
    // title-based entry (with its search candidates) and never hit the
    // details endpoint.
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).includes("/movie/42"))
    ).toBe(true)
    expect(byId).toEqual([
      {
        posterPath: "/poster.jpg",
        identity: { providerId: 42, title: "Cache Test" },
      },
    ])
  })

  it("ignores a negative entry from the previous cache namespace", async () => {
    const title = "Legacy Cache Test"
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
      jsonResponse({
        results: [{ id: 84, title, poster_path: "/legacy-poster.jpg" }],
      })
    )
    const dependencies = {
      waitUntil: () => {},
      fetch: fetchMock,
    }
    const requests = [{ title, mediaKind: "movie" as const }]
    const legacyCacheUrl = await getArtworkCacheUrl(
      [title.toLowerCase(), "movie", null, null, null, null],
      MEDIA_ARTWORK_CACHE_VERSION - 1
    )
    await globalThis.caches?.default.put(
      legacyCacheUrl,
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    )

    const result = await lookupMediaArtworkCached(
      { TMDB_API_READ_ACCESS_TOKEN: TMDB_TOKEN },
      requests,
      dependencies
    )

    expect(fetchMock).toHaveBeenCalled()
    expect(result[0]).toMatchObject({
      posterPath: "/legacy-poster.jpg",
      identity: { providerId: 84, title },
    })
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
    expect(first).toEqual([{ failed: true }])
    expect(second).toEqual([{ failed: true }])
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1)
  })
})

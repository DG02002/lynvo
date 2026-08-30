import { describe, expect, it, vi } from "vitest"
import { lookupMediaArtwork } from "../../workers/media-metadata/media-artwork-lookup"

interface TmdbStubResultItem {
  readonly id?: number
  readonly title?: string
  readonly name?: string
  readonly poster_path?: string | null
}

interface TmdbStubPayload {
  readonly id?: number
  readonly name?: string
  readonly still_path?: string | null
  readonly season_number?: number
  readonly episode_number?: number
  readonly status_message?: string
  readonly results?: readonly TmdbStubResultItem[]
}

interface TmdbStubRoute {
  readonly urlIncludes: string
  readonly payload: TmdbStubPayload
}

const jsonResponse = (payload: TmdbStubPayload): Response =>
  new Response(JSON.stringify(payload), { status: 200 })

const createUrlRoutingFetch = (routes: readonly TmdbStubRoute[]) =>
  vi.fn(async (input: RequestInfo | URL) => {
    const requestUrl = String(input)
    const route = routes.find((candidate) =>
      requestUrl.includes(candidate.urlIncludes)
    )
    if (!route) {
      return jsonResponse({ status_message: `No route for ${requestUrl}` })
    }
    return jsonResponse(route.payload)
  })

describe("Media artwork lookup", () => {
  it("returns empty results when the provider credential is absent", async () => {
    const fetch = vi.fn()

    const results = await lookupMediaArtwork(
      {},
      [{ title: "Example Movie", year: 2026 }],
      { fetch }
    )

    expect(results).toEqual([{}])
    expect(fetch).not.toHaveBeenCalled()
  })

  it("resolves movie posters from search results", async () => {
    const fetch = createUrlRoutingFetch([
      {
        urlIncludes: "/search/movie?",
        payload: {
          results: [{ id: 42, title: "Example Movie", poster_path: "/m.jpg" }],
        },
      },
    ])

    const results = await lookupMediaArtwork(
      { TMDB_API_READ_ACCESS_TOKEN: "secret-token" },
      [{ title: "Example Movie", year: 2026 }],
      { fetch }
    )

    expect(results).toEqual([
      {
        posterPath: "/m.jpg",
        identity: { providerId: 42, title: "Example Movie" },
        candidates: [
          {
            providerId: 42,
            title: "Example Movie",
            mediaKind: "movie",
            posterPath: "/m.jpg",
          },
        ],
      },
    ])
  })

  it("resolves episode stills through the tv search and episode details", async () => {
    const fetch = createUrlRoutingFetch([
      {
        urlIncludes: "/search/tv?",
        payload: {
          results: [{ id: 7, name: "Example Show", poster_path: "/s.jpg" }],
        },
      },
      {
        urlIncludes: "/season/2/episode/5",
        payload: {
          id: 71,
          name: "Example Show",
          still_path: "/e.jpg",
          season_number: 2,
          episode_number: 5,
        },
      },
    ])

    const results = await lookupMediaArtwork(
      { TMDB_API_READ_ACCESS_TOKEN: "secret-token" },
      [{ title: "Example Show", seasonNumber: 2, episodeNumber: 5 }],
      { fetch }
    )

    expect(results).toEqual([
      {
        posterPath: "/s.jpg",
        stillPath: "/e.jpg",
        identity: { providerId: 7, title: "Example Show" },
        candidates: [
          {
            providerId: 7,
            title: "Example Show",
            mediaKind: "tv",
            posterPath: "/s.jpg",
          },
        ],
      },
    ])
  })

  it("resolves show posters through the tv search for tv title requests", async () => {
    const fetch = createUrlRoutingFetch([
      {
        urlIncludes: "/search/tv?",
        payload: {
          results: [{ id: 9, name: "Example Show", poster_path: "/tv.jpg" }],
        },
      },
    ])

    const results = await lookupMediaArtwork(
      { TMDB_API_READ_ACCESS_TOKEN: "secret-token" },
      [{ mediaKind: "tv", title: "Example Show" }],
      { fetch }
    )

    expect(results).toEqual([
      {
        posterPath: "/tv.jpg",
        identity: { providerId: 9, title: "Example Show" },
        candidates: [
          {
            providerId: 9,
            title: "Example Show",
            mediaKind: "tv",
            posterPath: "/tv.jpg",
          },
        ],
      },
    ])
  })

  it("returns empty artwork when no search result matches", async () => {
    const fetch = createUrlRoutingFetch([
      { urlIncludes: "/search/movie?", payload: { results: [] } },
    ])

    const results = await lookupMediaArtwork(
      { TMDB_API_READ_ACCESS_TOKEN: "secret-token" },
      [{ title: "Unknown Movie" }],
      { fetch }
    )

    expect(results).toEqual([{}])
  })

  it("still offers picker candidates when nothing confidently matches", async () => {
    const fetch = createUrlRoutingFetch([
      {
        urlIncludes: "/search/movie?",
        payload: {
          results: [{ id: 5, title: "Unrelated Hit", poster_path: "/u.jpg" }],
        },
      },
    ])

    const results = await lookupMediaArtwork(
      { TMDB_API_READ_ACCESS_TOKEN: "secret-token" },
      [{ title: "Unknown Movie" }],
      { fetch }
    )

    expect(results).toEqual([
      {
        candidates: [
          {
            providerId: 5,
            title: "Unrelated Hit",
            mediaKind: "movie",
            posterPath: "/u.jpg",
          },
        ],
      },
    ])
  })

  it("resolves stored identities by provider id without title matching", async () => {
    const fetch = createUrlRoutingFetch([
      {
        urlIncludes: "/movie/42",
        payload: { id: 42, title: "Picked Movie", poster_path: "/p.jpg" },
      },
    ])

    const results = await lookupMediaArtwork(
      { TMDB_API_READ_ACCESS_TOKEN: "secret-token" },
      [{ title: "Wrong Guess", mediaKind: "movie", providerId: 42 }],
      { fetch }
    )

    expect(results).toEqual([
      {
        posterPath: "/p.jpg",
        identity: { providerId: 42, title: "Picked Movie" },
      },
    ])
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/movie/42")
  })

  it("resolves anime subtitle titles through the parent show's named season", async () => {
    const fetch = createUrlRoutingFetch([
      {
        urlIncludes: "/search/tv?",
        payload: {
          results: [{ id: 30984, name: "Bleach", poster_path: "/bleach.jpg" }],
        },
      },
      {
        urlIncludes: "/tv/30984/season/2",
        payload: {
          id: 30984,
          name: "Thousand-Year Blood War",
          poster_path: "/tybw-season.jpg",
          season_number: 2,
        },
      },
      {
        urlIncludes: "/tv/30984",
        payload: {
          id: 30984,
          seasons: [
            { season_number: 0, name: "Specials" },
            { season_number: 1, name: "Bleach" },
            { season_number: 2, name: "Thousand-Year Blood War" },
          ],
        },
      },
    ])

    const results = await lookupMediaArtwork(
      { TMDB_API_READ_ACCESS_TOKEN: "secret-token" },
      [
        {
          mediaKind: "tv",
          title: "Bleach Thousand Year Blood War",
          seasonNumber: 4,
        },
      ],
      { fetch }
    )

    expect(results).toEqual([
      {
        posterPath: "/tybw-season.jpg",
        identity: { providerId: 30984, title: "Bleach" },
        candidates: [
          {
            providerId: 30984,
            title: "Bleach",
            mediaKind: "tv",
            posterPath: "/bleach.jpg",
          },
        ],
      },
    ])
  })

  it("keeps artwork empty when no parent season name covers the query remainder", async () => {
    const fetch = createUrlRoutingFetch([
      {
        urlIncludes: "/search/tv?",
        payload: {
          results: [{ id: 30984, name: "Bleach", poster_path: "/bleach.jpg" }],
        },
      },
      {
        urlIncludes: "/tv/30984",
        payload: {
          id: 30984,
          seasons: [{ season_number: 1, name: "Bleach" }],
        },
      },
    ])

    const results = await lookupMediaArtwork(
      { TMDB_API_READ_ACCESS_TOKEN: "secret-token" },
      [{ mediaKind: "tv", title: "Bleach Unrelated Words" }],
      { fetch }
    )

    expect(results).toEqual([
      {
        candidates: [
          {
            providerId: 30984,
            title: "Bleach",
            mediaKind: "tv",
            posterPath: "/bleach.jpg",
          },
        ],
      },
    ])
  })

  it("retries without the year when the filename year hides the work", async () => {
    const fetch = createUrlRoutingFetch([
      {
        urlIncludes: "year=2099",
        payload: { results: [] },
      },
      {
        urlIncludes: "/search/movie?",
        payload: {
          results: [{ id: 42, title: "Toxic", poster_path: "/t.jpg" }],
        },
      },
    ])

    const results = await lookupMediaArtwork(
      { TMDB_API_READ_ACCESS_TOKEN: "secret-token" },
      [{ mediaKind: "movie", title: "Toxic", year: 2099 }],
      { fetch }
    )

    expect(results).toEqual([
      {
        posterPath: "/t.jpg",
        identity: { providerId: 42, title: "Toxic" },
        candidates: [
          {
            providerId: 42,
            title: "Toxic",
            mediaKind: "movie",
            posterPath: "/t.jpg",
          },
        ],
      },
    ])
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

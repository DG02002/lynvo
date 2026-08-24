import { describe, expect, it, vi } from "vitest"
import { createTmdbAdapter } from "../../workers/media-metadata/tmdb-adapter"

const createFetch = (response: Response) => vi.fn(async () => response)

describe("TMDB adapter", () => {
  it("does not make requests when the provider credential is absent", async () => {
    const fetch = vi.fn()
    const adapter = createTmdbAdapter({ fetch })

    const result = await adapter.searchMovie("Example Movie", 2026)

    expect(result).toEqual({
      kind: "disabled",
      message: "TMDB metadata is disabled",
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("sends authenticated search requests and validates the response", async () => {
    const fetch = createFetch(
      new Response(
        JSON.stringify({
          results: [
            {
              id: 42,
              title: "Example Movie",
              release_date: "2026-04-03",
              poster_path: "/poster.jpg",
              overview: "A short description.",
            },
            { id: -1, title: "Invalid" },
          ],
        }),
        { status: 200 }
      )
    )
    const adapter = createTmdbAdapter({
      fetch,
      token: "secret-token",
      now: () => 1_750_000_000_000,
    })

    const result = await adapter.searchMovie("Example Movie", 2026)

    expect(result.kind).toBe("success")
    expect(result.value).toEqual([
      {
        providerId: 42,
        title: "Example Movie",
        year: 2026,
        posterPath: "/poster.jpg",
        overview: "A short description.",
      },
    ])
    const [requestUrl, requestInit] = fetch.mock.calls[0] ?? []
    expect(String(requestUrl)).toContain("/search/movie?")
    expect(String(requestUrl)).toContain("query=Example+Movie")
    expect(String(requestUrl)).toContain("year=2026")
    expect(requestInit).toMatchObject({
      headers: {
        Authorization: "Bearer secret-token",
      },
    })
  })

  it("honors Retry-After for rate limits", async () => {
    const fetch = createFetch(
      new Response(JSON.stringify({ status_message: "Slow down" }), {
        status: 429,
        headers: { "Retry-After": "12" },
      })
    )
    const adapter = createTmdbAdapter({
      fetch,
      token: "secret-token",
      now: () => 1_750_000_000_000,
    })

    const result = await adapter.getMovieDetails(42)

    expect(result).toMatchObject({
      kind: "failure",
      failureKind: "rate-limited",
      retryAt: 1_750_000_012_000,
    })
  })

  it("retries transient connection failures before returning", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network connection lost."))
      .mockRejectedValueOnce(new Error("Network connection lost."))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                id: 42,
                title: "Doctor Strange",
                release_date: "2016-11-04",
                poster_path: "/poster.jpg",
              },
            ],
          }),
          { status: 200 }
        )
      )
    const sleep = vi.fn(async () => undefined)
    const adapter = createTmdbAdapter({
      fetch,
      sleep,
      token: "secret-token",
    })

    const result = await adapter.searchMovie("Doctor Strange", 2016)

    expect(result.kind).toBe("success")
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it("classifies provider failures and malformed payloads without throwing", async () => {
    const serverFetch = createFetch(new Response("", { status: 503 }))
    const serverAdapter = createTmdbAdapter({
      fetch: serverFetch,
      token: "secret-token",
    })
    const serverResult = await serverAdapter.getTvDetails(42)
    expect(serverResult).toMatchObject({
      kind: "failure",
      failureKind: "retryable",
    })

    const malformedFetch = createFetch(
      new Response(JSON.stringify({ results: "not-an-array" }), { status: 200 })
    )
    const malformedAdapter = createTmdbAdapter({
      fetch: malformedFetch,
      token: "secret-token",
    })
    const malformedResult = await malformedAdapter.searchTv("Example")
    expect(malformedResult).toMatchObject({
      kind: "failure",
      failureKind: "permanent",
    })
  })

  it("normalizes movie details with TMDB attribution", async () => {
    const fetch = createFetch(
      new Response(
        JSON.stringify({
          id: 42,
          title: "Example Movie",
          release_date: "2026-04-03",
          poster_path: "/poster.jpg",
          backdrop_path: "/backdrop.jpg",
          overview: "A short description.",
        }),
        { status: 200 }
      )
    )
    const adapter = createTmdbAdapter({ fetch, token: "secret-token" })

    const result = await adapter.getMovieDetails(42)

    expect(result).toEqual({
      kind: "success",
      value: {
        kind: "movie",
        providerId: 42,
        title: "Example Movie",
        year: 2026,
        posterPath: "/poster.jpg",
        backdropPath: "/backdrop.jpg",
        overview: "A short description.",
        attribution: "TMDB",
      },
    })
  })

  it("resolves release-part episode numbering through TMDB episode groups", async () => {
    const responses = [
      new Response(
        JSON.stringify({ status_message: "The resource was not found." }),
        { status: 404 }
      ),
      new Response(
        JSON.stringify({
          results: [{ id: "parts-group", name: "Parts" }],
        }),
        { status: 200 }
      ),
      new Response(
        JSON.stringify({
          groups: [
            {
              name: "Part 4",
              order: 4,
              episodes: [
                {
                  id: 29,
                  name: "Chapter Twenty-Nine: The Eldritch Dark",
                  order: 0,
                  season_number: 2,
                  episode_number: 9,
                  still_path: "/episode.jpg",
                },
              ],
            },
          ],
        }),
        { status: 200 }
      ),
    ]
    let responseIndex = 0
    const fetch = vi.fn(() => {
      const response = responses[responseIndex]
      responseIndex += 1
      if (!response) {
        throw new Error("Missing TMDB fixture response")
      }
      return Promise.resolve(response)
    })
    const adapter = createTmdbAdapter({ fetch, token: "secret-token" })

    const result = await adapter.getTvEpisodeDetails(79242, 4, 1)

    expect(result).toEqual({
      kind: "success",
      value: {
        kind: "episode",
        providerId: 29,
        title: "Chapter Twenty-Nine: The Eldritch Dark",
        stillPath: "/episode.jpg",
        seasonNumber: 4,
        episodeNumber: 1,
        attribution: "TMDB",
      },
    })
  })
})

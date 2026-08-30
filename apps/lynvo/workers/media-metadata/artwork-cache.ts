import {
  lookupMediaArtworkOutcomes,
  mediaArtworkOutcomeToResult,
  type MediaArtworkCandidate,
  type MediaArtworkIdentity,
} from "./media-artwork-lookup"

interface MediaArtworkRequest {
  readonly title: string
  readonly mediaKind?: "movie" | "tv"
  readonly providerId?: number
  readonly year?: number
  readonly seasonNumber?: number
  readonly episodeNumber?: number
}

interface MediaArtworkResult {
  readonly posterPath?: string
  readonly stillPath?: string
  readonly identity?: MediaArtworkIdentity
  readonly candidates?: readonly MediaArtworkCandidate[]
  readonly failed?: boolean
}

interface MediaArtworkLookupEnvironment {
  readonly TMDB_API_READ_ACCESS_TOKEN?: string
}

export interface MediaArtworkCacheDependencies {
  readonly waitUntil: (promise: Promise<unknown>) => void
  readonly fetch?: typeof globalThis.fetch
}

// TMDB artwork is immutable and user-agnostic, so a shared per-colo cache
// keyed by the normalized lookup request is safe. The synthetic origin never
// leaves the cache; no request is made against it.
const ARTWORK_CACHE_ORIGIN = "https://lynvo-tmdb-artwork-cache.internal"
const ARTWORK_CACHE_HIT_TTL_SECONDS = 30 * 24 * 60 * 60
const ARTWORK_CACHE_MISS_TTL_SECONDS = 24 * 60 * 60

// Provider-id lookups must not collide with title lookups of the same
// title: a user's artwork correction would keep hitting the earlier
// title-based cache entry, so the id is part of the key's identity.
const canonicalRequestJson = (request: MediaArtworkRequest): string =>
  JSON.stringify([
    request.title.normalize("NFKC").trim().toLowerCase(),
    request.mediaKind ?? null,
    request.providerId ?? null,
    request.year ?? null,
    request.seasonNumber ?? null,
    request.episodeNumber ?? null,
  ])

const buildCacheUrl = async (request: MediaArtworkRequest): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalRequestJson(request))
  )
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
  return `${ARTWORK_CACHE_ORIGIN}/${hash}.json`
}

const readCachedResult = async (
  cache: Cache,
  url: string
): Promise<MediaArtworkResult | undefined> => {
  const cached = await cache.match(url)
  if (!cached) {
    return undefined
  }
  try {
    // SAFETY: cache entries are written exclusively by writeCachedResult,
    // whose bodies are MediaArtworkResult JSON.
    return (await cached.json()) as MediaArtworkResult
  } catch {
    return undefined
  }
}

interface WriteCachedResultInput {
  readonly cache: Cache
  readonly url: string
  readonly result: MediaArtworkResult
  readonly nowSeconds: number
}

const writeCachedResult = async ({
  cache,
  url,
  result,
  nowSeconds,
}: WriteCachedResultInput): Promise<void> => {
  const isPositiveResult =
    result.posterPath !== undefined || result.stillPath !== undefined
  const maxAge = isPositiveResult
    ? ARTWORK_CACHE_HIT_TTL_SECONDS
    : ARTWORK_CACHE_MISS_TTL_SECONDS
  await cache.put(
    url,
    new Response(JSON.stringify(result), {
      headers: {
        "content-type": "application/json",
        "cache-control": `public, max-age=${maxAge}`,
        expires: new Date((nowSeconds + maxAge) * 1000).toUTCString(),
      },
    })
  )
}

export const lookupMediaArtworkCached = async (
  environment: MediaArtworkLookupEnvironment,
  requests: readonly MediaArtworkRequest[],
  dependencies: MediaArtworkCacheDependencies
): Promise<readonly MediaArtworkResult[]> => {
  // SAFETY: Workers exposes caches.default (the colo cache) beyond the
  // standard CacheStorage interface; it is absent in some test runtimes.
  const cacheWithDefault = globalThis.caches as CacheStorage & {
    default?: Cache
  }
  const cache = cacheWithDefault?.default
  if (!cache) {
    const outcomes = await lookupMediaArtworkOutcomes(environment, requests, {
      fetch: dependencies.fetch ?? globalThis.fetch.bind(globalThis),
    })
    return outcomes.map(mediaArtworkOutcomeToResult)
  }
  const nowSeconds = Math.floor(Date.now() / 1000)
  const cacheUrls = await Promise.all(requests.map(buildCacheUrl))
  const cachedResults = await Promise.all(
    cacheUrls.map(async (url) => await readCachedResult(cache, url))
  )
  const missedIndexes: number[] = []
  cachedResults.forEach((cachedResult, resultIndex) => {
    if (cachedResult === undefined) {
      missedIndexes.push(resultIndex)
    }
  })
  const missedRequests = missedIndexes.map((index) => requests[index])
  const freshOutcomes = missedIndexes.length
    ? await lookupMediaArtworkOutcomes(environment, missedRequests, {
        fetch: dependencies.fetch ?? globalThis.fetch.bind(globalThis),
      })
    : []
  missedIndexes.forEach((requestIndex, missIndex) => {
    const url = cacheUrls[requestIndex]
    const outcome = freshOutcomes[missIndex]
    if (outcome?.status === "failed") {
      // Transient upstream failures stay uncached so the next request retries.
      cachedResults[requestIndex] = { failed: true }
      return
    }
    const result = mediaArtworkOutcomeToResult(outcome ?? { status: "empty" })
    cachedResults[requestIndex] = result
    if (url) {
      dependencies.waitUntil(
        writeCachedResult({
          cache,
          url,
          result,
          nowSeconds,
        }).catch(() => undefined)
      )
    }
  })
  return cachedResults.map((result) => result ?? {})
}

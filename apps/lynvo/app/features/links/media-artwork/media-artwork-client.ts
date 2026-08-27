import { Result, Schema } from "effect"
import {
  MEDIA_ARTWORK_API_TIMEOUT_MS,
  MEDIA_ARTWORK_BATCH_SIZE,
  MEDIA_ARTWORK_CACHE_STORAGE_PREFIX,
  MEDIA_ARTWORK_FLUSH_DELAY_MS,
  MEDIA_ARTWORK_FOUND_TTL_MS,
  MEDIA_ARTWORK_NOT_FOUND_TTL_MS,
} from "~/lib/constants"

const mediaArtworkResultSchema = Schema.Struct({
  posterPath: Schema.optional(Schema.String),
  stillPath: Schema.optional(Schema.String),
})

const mediaArtworkResponseSchema = Schema.Struct({
  results: Schema.Array(mediaArtworkResultSchema),
})

export const getMediaArtworkKey = (request: MediaArtworkRequest): string =>
  [
    request.mediaKind,
    request.title.normalize("NFKC").toLocaleLowerCase(),
    request.year ?? "",
    request.seasonNumber ?? "",
    request.episodeNumber ?? "",
  ].join("|")

const mediaArtworkResults = new Map<string, MediaArtworkResult | null>()
const mediaArtworkListeners = new Map<string, Set<() => void>>()
const pendingMediaArtworkRequests = new Map<string, MediaArtworkRequest>()
let mediaArtworkFlushTimer: ReturnType<typeof setTimeout> | undefined

interface CachedMediaArtworkEntry {
  readonly value: MediaArtworkResult | null
  readonly expiresAt: number
}

const toMediaArtworkCacheKey = (key: string): string =>
  `${MEDIA_ARTWORK_CACHE_STORAGE_PREFIX}${key}`

const readCachedMediaArtwork = (
  key: string
): MediaArtworkResult | null | undefined => {
  if (globalThis.localStorage === undefined) {
    return undefined
  }
  try {
    const cachedEntry = localStorage.getItem(toMediaArtworkCacheKey(key))
    if (cachedEntry === null) {
      return undefined
    }
    // SAFETY: untrusted storage JSON; malformed shapes fall through to the catch below
    const parsedEntry = JSON.parse(cachedEntry) as CachedMediaArtworkEntry
    if (
      !parsedEntry ||
      !Number.isFinite(parsedEntry.expiresAt) ||
      parsedEntry.expiresAt <= Date.now()
    ) {
      localStorage.removeItem(toMediaArtworkCacheKey(key))
      return undefined
    }
    return parsedEntry.value ?? null
  } catch {
    return undefined
  }
}

const writeCachedMediaArtwork = (
  key: string,
  value: MediaArtworkResult | null
): void => {
  if (globalThis.localStorage === undefined) {
    return
  }
  const hasResolvedArtwork = Boolean(value?.posterPath || value?.stillPath)
  try {
    const cacheEntry: CachedMediaArtworkEntry = {
      value,
      expiresAt:
        Date.now() +
        (hasResolvedArtwork
          ? MEDIA_ARTWORK_FOUND_TTL_MS
          : MEDIA_ARTWORK_NOT_FOUND_TTL_MS),
    }
    localStorage.setItem(
      toMediaArtworkCacheKey(key),
      JSON.stringify(cacheEntry)
    )
  } catch {
    // Storage quota or private-mode failures must never break lookups
  }
}

const notifyMediaArtworkListeners = (key: string): void => {
  for (const listener of mediaArtworkListeners.get(key) ?? []) {
    listener()
  }
}

export const subscribeToMediaArtwork = (
  key: string,
  listener: () => void
): (() => void) => {
  const keyListeners = mediaArtworkListeners.get(key) ?? new Set()
  keyListeners.add(listener)
  mediaArtworkListeners.set(key, keyListeners)
  return () => {
    keyListeners.delete(listener)
    if (keyListeners.size === 0) {
      mediaArtworkListeners.delete(key)
    }
  }
}

export const getMediaArtworkForKey = (
  key: string
): MediaArtworkResult | null | undefined => mediaArtworkResults.get(key)

const scheduleMediaArtworkFlush = (): void => {
  if (mediaArtworkFlushTimer !== undefined) {
    return
  }
  mediaArtworkFlushTimer = setTimeout(() => {
    mediaArtworkFlushTimer = undefined
    void flushPendingMediaArtwork()
  }, MEDIA_ARTWORK_FLUSH_DELAY_MS)
}

export const requestMediaArtwork = (
  key: string,
  request: MediaArtworkRequest
): void => {
  if (mediaArtworkResults.has(key) || pendingMediaArtworkRequests.has(key)) {
    return
  }
  const cachedResult = readCachedMediaArtwork(key)
  if (cachedResult !== undefined) {
    mediaArtworkResults.set(key, cachedResult)
    notifyMediaArtworkListeners(key)
    return
  }
  pendingMediaArtworkRequests.set(key, request)
  scheduleMediaArtworkFlush()
}

const flushPendingMediaArtwork = async (): Promise<void> => {
  const batchEntries = [...pendingMediaArtworkRequests.entries()].slice(
    0,
    MEDIA_ARTWORK_BATCH_SIZE
  )
  if (batchEntries.length === 0) {
    return
  }
  for (const [key] of batchEntries) {
    pendingMediaArtworkRequests.delete(key)
  }
  if (pendingMediaArtworkRequests.size > 0) {
    scheduleMediaArtworkFlush()
  }

  try {
    const response = await fetch("/api/data/media-artwork", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: batchEntries.map(([, request]) => request),
      }),
      signal: AbortSignal.timeout?.(MEDIA_ARTWORK_API_TIMEOUT_MS),
    })
    if (!response.ok) {
      throw new Error("Media artwork lookup failed")
    }
    const parsed = Schema.decodeUnknownResult(mediaArtworkResponseSchema)(
      await response.json()
    )
    if (Result.isFailure(parsed)) {
      throw new Error("Media artwork response was invalid")
    }
    batchEntries.forEach(([key], index) => {
      const lookupResult = parsed.success.results[index] ?? null
      mediaArtworkResults.set(key, lookupResult)
      writeCachedMediaArtwork(key, lookupResult)
      notifyMediaArtworkListeners(key)
    })
  } catch {
    batchEntries.forEach(([key]) => {
      mediaArtworkResults.set(key, null)
      notifyMediaArtworkListeners(key)
    })
  }
}

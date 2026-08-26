import { Result, Schema } from "effect"
import {
  MEDIA_ARTWORK_API_TIMEOUT_MS,
  MEDIA_ARTWORK_BATCH_SIZE,
  MEDIA_ARTWORK_FLUSH_DELAY_MS,
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

const artworkResults = new Map<string, MediaArtworkResult | null>()
const artworkListeners = new Map<string, Set<() => void>>()
const pendingArtworkRequests = new Map<string, MediaArtworkRequest>()
let artworkFlushTimer: ReturnType<typeof setTimeout> | undefined

const notifyMediaArtworkListeners = (key: string): void => {
  for (const listener of artworkListeners.get(key) ?? []) {
    listener()
  }
}

export const subscribeToMediaArtwork = (
  key: string,
  listener: () => void
): (() => void) => {
  const keyListeners = artworkListeners.get(key) ?? new Set()
  keyListeners.add(listener)
  artworkListeners.set(key, keyListeners)
  return () => {
    keyListeners.delete(listener)
    if (keyListeners.size === 0) {
      artworkListeners.delete(key)
    }
  }
}

export const getMediaArtworkForKey = (
  key: string
): MediaArtworkResult | null | undefined => artworkResults.get(key)

const scheduleMediaArtworkFlush = (): void => {
  if (artworkFlushTimer !== undefined) {
    return
  }
  artworkFlushTimer = setTimeout(() => {
    artworkFlushTimer = undefined
    void flushPendingMediaArtwork()
  }, MEDIA_ARTWORK_FLUSH_DELAY_MS)
}

export const requestMediaArtwork = (
  key: string,
  request: MediaArtworkRequest
): void => {
  if (artworkResults.has(key) || pendingArtworkRequests.has(key)) {
    return
  }
  pendingArtworkRequests.set(key, request)
  scheduleMediaArtworkFlush()
}

const flushPendingMediaArtwork = async (): Promise<void> => {
  const batchEntries = [...pendingArtworkRequests.entries()].slice(
    0,
    MEDIA_ARTWORK_BATCH_SIZE
  )
  if (batchEntries.length === 0) {
    return
  }
  for (const [key] of batchEntries) {
    pendingArtworkRequests.delete(key)
  }
  if (pendingArtworkRequests.size > 0) {
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
      artworkResults.set(key, parsed.success.results[index] ?? null)
      notifyMediaArtworkListeners(key)
    })
  } catch {
    batchEntries.forEach(([key]) => {
      artworkResults.set(key, null)
      notifyMediaArtworkListeners(key)
    })
  }
}

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react"

import type {
  MediaArtworkRequest,
  MediaArtworkResult,
} from "../../../../shared/api-contracts"
import {
  getMediaArtworkForKey,
  getMediaArtworkKey,
  requestMediaArtwork,
  subscribeToMediaArtwork,
} from "./media-artwork-client"

export const useMediaArtwork = (
  request: MediaArtworkRequest | undefined
): MediaArtworkResult | undefined => {
  const requestKey = useMemo(
    () => (request ? getMediaArtworkKey(request) : undefined),
    [request]
  )

  useEffect(() => {
    if (!request || !requestKey) {
      return
    }
    requestMediaArtwork(requestKey, request)
  }, [request, requestKey])

  const subscribe = useCallback(
    (listener: () => void) =>
      requestKey
        ? subscribeToMediaArtwork(requestKey, listener)
        : () => undefined,
    [requestKey]
  )
  const getSnapshot = useCallback(
    () => (requestKey ? getMediaArtworkForKey(requestKey) : undefined),
    [requestKey]
  )
  const artwork = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return artwork ?? undefined
}

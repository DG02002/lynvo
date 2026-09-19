import { useEffect, useSyncExternalStore } from "react"
import { useRouteLoaderData } from "react-router"

import { getCookieValueFromHeader } from "~/lib/auth-cookie"
import {
  getCurrentClientProfile,
  subscribeToClientProfile,
  TVBRO_ANDROID_TV_PROFILE,
} from "~/lib/client-profile"
import type { loader as rootLoader } from "~/root"

export type MediaView = "list" | "gallery"

export const MEDIA_VIEW_STORAGE_KEY = "lynvo:settings:media-view"
export const MEDIA_VIEW_PREFERENCE_EVENT = "lynvo:media-view-preference-changed"
export const MEDIA_VIEW_COOKIE_NAME = "lynvo-media-view"
const MEDIA_VIEW_COOKIE_MAX_AGE_SECONDS = 31_536_000
export const DEFAULT_MEDIA_VIEW: MediaView = "list"
const TVBRO_DEFAULT_MEDIA_VIEW: MediaView = "gallery"
const LEGACY_MEDIA_VIEW_VALUE = "hybrid"

const mediaViewValues = new Set<string>(["list", "gallery"])

const isMediaView = (value: string): value is MediaView =>
  mediaViewValues.has(value)

const normalizeMediaView = (value: string): MediaView | undefined => {
  if (value === LEGACY_MEDIA_VIEW_VALUE) {
    return "gallery"
  }
  return isMediaView(value) ? value : undefined
}

const getDefaultMediaView = (): MediaView =>
  getCurrentClientProfile() === TVBRO_ANDROID_TV_PROFILE
    ? TVBRO_DEFAULT_MEDIA_VIEW
    : DEFAULT_MEDIA_VIEW

const subscribeToMediaViewPreference = (onStoreChange: () => void) => {
  const unsubscribeFromClientProfile = subscribeToClientProfile(onStoreChange)
  window.addEventListener(MEDIA_VIEW_PREFERENCE_EVENT, onStoreChange)

  return () => {
    unsubscribeFromClientProfile()
    window.removeEventListener(MEDIA_VIEW_PREFERENCE_EVENT, onStoreChange)
  }
}

export const getMediaView = (): MediaView => {
  if (globalThis.localStorage === undefined) {
    return DEFAULT_MEDIA_VIEW
  }

  const storedValue = localStorage.getItem(MEDIA_VIEW_STORAGE_KEY)
  if (storedValue !== null) {
    const mediaView = normalizeMediaView(storedValue)
    if (mediaView !== undefined) {
      return mediaView
    }
  }
  return getDefaultMediaView()
}

const writeMediaViewCookie = (mediaView: MediaView): void => {
  if (globalThis.document === undefined) {
    return
  }
  globalThis.document.cookie = `${MEDIA_VIEW_COOKIE_NAME}=${mediaView}; Path=/; Max-Age=${MEDIA_VIEW_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`
}

export const getMediaViewFromCookieHeader = (
  cookieHeader: string | null
): MediaView | undefined => {
  const mediaViewCookieValue = getCookieValueFromHeader(
    cookieHeader,
    MEDIA_VIEW_COOKIE_NAME
  )

  if (mediaViewCookieValue !== undefined) {
    return normalizeMediaView(mediaViewCookieValue)
  }
  return undefined
}

export const setMediaView = (mediaView: MediaView): void => {
  localStorage.setItem(MEDIA_VIEW_STORAGE_KEY, mediaView)
  writeMediaViewCookie(mediaView)
  window.dispatchEvent(new Event(MEDIA_VIEW_PREFERENCE_EVENT))
}

export const useMediaView = (): MediaView => {
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const serverMediaView = rootData?.mediaView ?? DEFAULT_MEDIA_VIEW
  const mediaView = useSyncExternalStore(
    subscribeToMediaViewPreference,
    getMediaView,
    () => serverMediaView
  )

  useEffect(() => {
    writeMediaViewCookie(mediaView)
  }, [mediaView])

  return mediaView
}

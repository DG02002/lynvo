import { useEffect, useSyncExternalStore } from "react"
import { useRouteLoaderData } from "react-router"
import type { loader as rootLoader } from "~/root"
import {
  getCurrentClientProfile,
  TVBRO_ANDROID_TV_PROFILE,
} from "~/lib/client-profile"

declare global {
  type MediaView = "list" | "hybrid"
}

export const MEDIA_VIEW_STORAGE_KEY = "lynvo:settings:media-view"
export const MEDIA_VIEW_PREFERENCE_EVENT = "lynvo:media-view-preference-changed"
export const MEDIA_VIEW_COOKIE_NAME = "lynvo-media-view"
export const MEDIA_VIEW_COOKIE_MAX_AGE_SECONDS = 31_536_000
export const DEFAULT_MEDIA_VIEW: MediaView = "list"
export const TVBRO_DEFAULT_MEDIA_VIEW: MediaView = "hybrid"

const mediaViewValues = new Set<string>(["list", "hybrid"])

export const isMediaView = (value: string): value is MediaView =>
  mediaViewValues.has(value)

export const getDefaultMediaView = (): MediaView =>
  getCurrentClientProfile() === TVBRO_ANDROID_TV_PROFILE
    ? TVBRO_DEFAULT_MEDIA_VIEW
    : DEFAULT_MEDIA_VIEW

const subscribeToMediaViewPreference = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(MEDIA_VIEW_PREFERENCE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(MEDIA_VIEW_PREFERENCE_EVENT, onStoreChange)
  }
}

export const getMediaView = (): MediaView => {
  if (globalThis.localStorage === undefined) {
    return DEFAULT_MEDIA_VIEW
  }

  const storedValue = localStorage.getItem(MEDIA_VIEW_STORAGE_KEY)
  if (storedValue !== null && isMediaView(storedValue)) {
    return storedValue
  }
  return getDefaultMediaView()
}

export const writeMediaViewCookie = (mediaView: MediaView): void => {
  if (globalThis.document === undefined) {
    return
  }
  globalThis.document.cookie = `${MEDIA_VIEW_COOKIE_NAME}=${mediaView}; Path=/; Max-Age=${MEDIA_VIEW_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`
}

export const getMediaViewFromCookieHeader = (
  cookieHeader: string | null
): MediaView | undefined => {
  const mediaViewCookie = cookieHeader
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${MEDIA_VIEW_COOKIE_NAME}=`))
  const mediaViewCookieValue = mediaViewCookie?.slice(
    MEDIA_VIEW_COOKIE_NAME.length + 1
  )

  if (mediaViewCookieValue !== undefined && isMediaView(mediaViewCookieValue)) {
    return mediaViewCookieValue
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

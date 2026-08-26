import { useEffect } from "react"
import { useSyncExternalStore } from "react"
import { useRouteLoaderData } from "react-router"
import type { loader as rootLoader } from "~/root"

declare global {
  type LibraryMediaView = "list" | "hybrid" | "library"
}

export const LIBRARY_MEDIA_VIEW_STORAGE_KEY =
  "lynvo:settings:library-media-view"
export const LIBRARY_MEDIA_VIEW_PREFERENCE_EVENT =
  "lynvo:library-media-view-preference-changed"
export const MEDIA_VIEW_COOKIE_NAME = "lynvo-media-view"
export const MEDIA_VIEW_COOKIE_MAX_AGE_SECONDS = 31_536_000

const libraryMediaViewValues: readonly string[] = ["list", "hybrid", "library"]

export const isLibraryMediaView = (value: string): value is LibraryMediaView =>
  libraryMediaViewValues.includes(value)

const subscribeToLibraryMediaViewPreference = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(LIBRARY_MEDIA_VIEW_PREFERENCE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(
      LIBRARY_MEDIA_VIEW_PREFERENCE_EVENT,
      onStoreChange
    )
  }
}

export const getLibraryMediaView = (): LibraryMediaView => {
  if (globalThis.localStorage === undefined) {
    return "library"
  }

  const storedValue = localStorage.getItem(LIBRARY_MEDIA_VIEW_STORAGE_KEY)
  if (storedValue === "false") {
    return "list"
  }
  if (storedValue !== null && isLibraryMediaView(storedValue)) {
    return storedValue
  }
  return "library"
}

export const writeMediaViewCookie = (mediaView: LibraryMediaView): void => {
  if (globalThis.document === undefined) {
    return
  }
  globalThis.document.cookie = `${MEDIA_VIEW_COOKIE_NAME}=${mediaView}; Path=/; Max-Age=${MEDIA_VIEW_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`
}

export const getLibraryMediaViewFromCookieHeader = (
  cookieHeader: string | null
): LibraryMediaView | undefined => {
  const mediaViewCookie = cookieHeader
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${MEDIA_VIEW_COOKIE_NAME}=`))
  const mediaViewCookieValue = mediaViewCookie?.slice(
    MEDIA_VIEW_COOKIE_NAME.length + 1
  )

  if (
    mediaViewCookieValue !== undefined &&
    isLibraryMediaView(mediaViewCookieValue)
  ) {
    return mediaViewCookieValue
  }
  return undefined
}

export const setLibraryMediaView = (mediaView: LibraryMediaView): void => {
  localStorage.setItem(LIBRARY_MEDIA_VIEW_STORAGE_KEY, mediaView)
  writeMediaViewCookie(mediaView)
  window.dispatchEvent(new Event(LIBRARY_MEDIA_VIEW_PREFERENCE_EVENT))
}

export const useLibraryMediaView = (): LibraryMediaView => {
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const serverMediaView = rootData?.mediaView ?? "library"
  const mediaView = useSyncExternalStore(
    subscribeToLibraryMediaViewPreference,
    getLibraryMediaView,
    () => serverMediaView
  )

  useEffect(() => {
    writeMediaViewCookie(mediaView)
  }, [mediaView])

  return mediaView
}

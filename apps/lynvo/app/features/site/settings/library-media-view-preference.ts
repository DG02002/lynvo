import { useEffect } from "react"
import { useSyncExternalStore } from "react"
import { useRouteLoaderData } from "react-router"
import type { loader as rootLoader } from "~/root"

export const LIBRARY_MEDIA_VIEW_STORAGE_KEY =
  "lynvo:settings:library-media-view"
export const LIBRARY_MEDIA_VIEW_PREFERENCE_EVENT =
  "lynvo:library-media-view-preference-changed"
export const MEDIA_VIEW_COOKIE_NAME = "lynvo-media-view"
export const MEDIA_VIEW_COOKIE_MAX_AGE_SECONDS = 31_536_000

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

export const getShouldUseLibraryMediaView = (): boolean => {
  if (globalThis.localStorage === undefined) {
    return true
  }

  return localStorage.getItem(LIBRARY_MEDIA_VIEW_STORAGE_KEY) !== "false"
}

export const writeMediaViewCookie = (
  shouldUseLibraryMediaView: boolean
): void => {
  if (globalThis.document === undefined) {
    return
  }
  globalThis.document.cookie = `${MEDIA_VIEW_COOKIE_NAME}=${
    shouldUseLibraryMediaView ? "library" : "list"
  }; Path=/; Max-Age=${MEDIA_VIEW_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`
}

export const getMediaViewIsLibraryFromCookieHeader = (
  cookieHeader: string | null
): boolean | undefined => {
  const mediaViewCookie = cookieHeader
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${MEDIA_VIEW_COOKIE_NAME}=`))
  const mediaViewCookieValue = mediaViewCookie?.slice(
    MEDIA_VIEW_COOKIE_NAME.length + 1
  )

  if (mediaViewCookieValue === "library") {
    return true
  }
  if (mediaViewCookieValue === "list") {
    return false
  }
  return undefined
}

export const setShouldUseLibraryMediaView = (
  shouldUseLibraryMediaView: boolean
): void => {
  localStorage.setItem(
    LIBRARY_MEDIA_VIEW_STORAGE_KEY,
    String(shouldUseLibraryMediaView)
  )
  writeMediaViewCookie(shouldUseLibraryMediaView)
  window.dispatchEvent(new Event(LIBRARY_MEDIA_VIEW_PREFERENCE_EVENT))
}

export const useShouldUseLibraryMediaView = (): boolean => {
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const serverMediaViewIsLibrary = rootData?.mediaViewIsLibrary ?? true
  const shouldUseLibraryMediaView = useSyncExternalStore(
    subscribeToLibraryMediaViewPreference,
    getShouldUseLibraryMediaView,
    () => serverMediaViewIsLibrary
  )

  useEffect(() => {
    writeMediaViewCookie(shouldUseLibraryMediaView)
  }, [shouldUseLibraryMediaView])

  return shouldUseLibraryMediaView
}

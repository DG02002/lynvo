import { useSyncExternalStore } from "react"

export const LAYOUT_GUIDE_STORAGE_KEY = "lynvo:settings:layout-guide"
export const LAYOUT_GUIDE_PREFERENCE_EVENT =
  "lynvo:layout-guide-preference-changed"

const subscribeToLayoutGuidePreference = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(LAYOUT_GUIDE_PREFERENCE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(LAYOUT_GUIDE_PREFERENCE_EVENT, onStoreChange)
  }
}

export const getShouldShowLayoutGuide = (): boolean => {
  if (globalThis.localStorage === undefined) {
    return false
  }

  return localStorage.getItem(LAYOUT_GUIDE_STORAGE_KEY) === "true"
}

export const setShouldShowLayoutGuide = (
  shouldShowLayoutGuide: boolean
): void => {
  if (globalThis.localStorage !== undefined) {
    localStorage.setItem(
      LAYOUT_GUIDE_STORAGE_KEY,
      String(shouldShowLayoutGuide)
    )
  }
  if (globalThis.window !== undefined) {
    window.dispatchEvent(new Event(LAYOUT_GUIDE_PREFERENCE_EVENT))
  }
}

export const useShouldShowLayoutGuide = (): boolean =>
  useSyncExternalStore(
    subscribeToLayoutGuidePreference,
    getShouldShowLayoutGuide,
    () => false
  )

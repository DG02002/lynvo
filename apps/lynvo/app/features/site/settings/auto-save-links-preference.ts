import { useSyncExternalStore } from "react"

export const AUTO_SAVE_LINKS_STORAGE_KEY = "lynvo:settings:auto-save-all-links"
export const AUTO_SAVE_LINKS_PREFERENCE_EVENT =
  "lynvo:auto-save-all-links-preference-changed"

const subscribeToAutoSaveLinksPreference = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(AUTO_SAVE_LINKS_PREFERENCE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(AUTO_SAVE_LINKS_PREFERENCE_EVENT, onStoreChange)
  }
}

export const getShouldAutoSaveAllLinks = (): boolean => {
  if (globalThis.localStorage === undefined) {
    return false
  }

  return localStorage.getItem(AUTO_SAVE_LINKS_STORAGE_KEY) === "true"
}

export const setShouldAutoSaveAllLinks = (
  shouldAutoSaveAllLinks: boolean
): void => {
  if (globalThis.localStorage !== undefined) {
    localStorage.setItem(
      AUTO_SAVE_LINKS_STORAGE_KEY,
      String(shouldAutoSaveAllLinks)
    )
  }
  if (globalThis.window !== undefined) {
    window.dispatchEvent(new Event(AUTO_SAVE_LINKS_PREFERENCE_EVENT))
  }
}

export const useShouldAutoSaveAllLinks = () =>
  useSyncExternalStore(
    subscribeToAutoSaveLinksPreference,
    getShouldAutoSaveAllLinks,
    () => false
  )

import { useSyncExternalStore } from "react"

export const AUTO_SAVE_LINKS_STORAGE_KEY =
  "lynvo:settings:auto-save-all-extracted-links"

const AUTO_SAVE_LINKS_PREFERENCE_EVENT =
  "lynvo:auto-save-links-preference-changed"

const subscribeToAutoSaveLinksPreference = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(AUTO_SAVE_LINKS_PREFERENCE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(AUTO_SAVE_LINKS_PREFERENCE_EVENT, onStoreChange)
  }
}

export const getShouldAutoSaveAllLinks = () => {
  if (globalThis.localStorage === undefined) {
    return true
  }

  return localStorage.getItem(AUTO_SAVE_LINKS_STORAGE_KEY) !== "false"
}

export const setShouldAutoSaveAllLinks = (shouldAutoSave: boolean) => {
  localStorage.setItem(AUTO_SAVE_LINKS_STORAGE_KEY, String(shouldAutoSave))
  window.dispatchEvent(new Event(AUTO_SAVE_LINKS_PREFERENCE_EVENT))
}

export const useShouldAutoSaveAllLinks = () =>
  useSyncExternalStore(
    subscribeToAutoSaveLinksPreference,
    getShouldAutoSaveAllLinks,
    () => true
  )

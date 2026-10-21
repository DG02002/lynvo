import { useSyncExternalStore } from "react"

export const ASK_BEFORE_MARKING_AS_WATCHED_STORAGE_KEY =
  "lynvo:settings:ask-before-marking-as-watched"
const ASK_BEFORE_MARKING_AS_WATCHED_EVENT =
  "lynvo:ask-before-marking-as-watched-changed"

const subscribeToAskBeforeMarkingAsWatched = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(ASK_BEFORE_MARKING_AS_WATCHED_EVENT, onStoreChange)

  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(
      ASK_BEFORE_MARKING_AS_WATCHED_EVENT,
      onStoreChange
    )
  }
}

export const getShouldAskBeforeMarkingAsWatched = (): boolean => {
  if (globalThis.localStorage === undefined) {
    return false
  }

  return (
    localStorage.getItem(ASK_BEFORE_MARKING_AS_WATCHED_STORAGE_KEY) === "true"
  )
}

export const setShouldAskBeforeMarkingAsWatched = (
  shouldAskBeforeMarkingAsWatched: boolean
): void => {
  if (globalThis.localStorage !== undefined) {
    localStorage.setItem(
      ASK_BEFORE_MARKING_AS_WATCHED_STORAGE_KEY,
      String(shouldAskBeforeMarkingAsWatched)
    )
  }
  if (globalThis.window !== undefined) {
    window.dispatchEvent(new Event(ASK_BEFORE_MARKING_AS_WATCHED_EVENT))
  }
}

export const useShouldAskBeforeMarkingAsWatched = () =>
  useSyncExternalStore(
    subscribeToAskBeforeMarkingAsWatched,
    getShouldAskBeforeMarkingAsWatched,
    () => false
  )

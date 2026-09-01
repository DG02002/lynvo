import { useSyncExternalStore } from "react"

declare global {
  type FolderTitleDisplay = "episode" | "filename"
}

export const FOLDER_TITLE_DISPLAY_STORAGE_KEY =
  "lynvo:settings:folder-title-display"

const FOLDER_TITLE_DISPLAY_EVENT = "lynvo:folder-title-display-changed"

const folderTitleDisplayValues = new Set<string>(["episode", "filename"])

const isFolderTitleDisplay = (value: string): value is FolderTitleDisplay =>
  folderTitleDisplayValues.has(value)

const subscribeToFolderTitleDisplay = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(FOLDER_TITLE_DISPLAY_EVENT, onStoreChange)

  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(FOLDER_TITLE_DISPLAY_EVENT, onStoreChange)
  }
}

const readFolderTitleDisplay = (): FolderTitleDisplay | undefined => {
  if (globalThis.localStorage === undefined) {
    return undefined
  }

  const storedValue = localStorage.getItem(FOLDER_TITLE_DISPLAY_STORAGE_KEY)
  if (storedValue !== null && isFolderTitleDisplay(storedValue)) {
    return storedValue
  }
  return undefined
}

export const useFolderTitleDisplay = (
  fallbackTitleDisplay: FolderTitleDisplay
): readonly [FolderTitleDisplay, () => void] => {
  const folderTitleDisplay = useSyncExternalStore(
    subscribeToFolderTitleDisplay,
    () => readFolderTitleDisplay() ?? fallbackTitleDisplay,
    () => fallbackTitleDisplay
  )

  const toggleFolderTitleDisplay = () => {
    const nextTitleDisplay: FolderTitleDisplay =
      folderTitleDisplay === "episode" ? "filename" : "episode"
    localStorage.setItem(FOLDER_TITLE_DISPLAY_STORAGE_KEY, nextTitleDisplay)
    window.dispatchEvent(new Event(FOLDER_TITLE_DISPLAY_EVENT))
  }

  return [folderTitleDisplay, toggleFolderTitleDisplay]
}

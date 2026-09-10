import { useEffect, useMemo, useRef, useState } from "react"
import { Result, Schema } from "effect"
import type { NavigationType } from "react-router"

const BROWSER_HISTORY_OFFSET_KEY = "__lynvoHistoryOffset"

const browserHistoryStateSchema = Schema.Struct({
  idx: Schema.optional(Schema.Number),
  [BROWSER_HISTORY_OFFSET_KEY]: Schema.optional(Schema.Number),
})

interface FolderHistoryEntry {
  key: string
  folderIds: string[]
}

export interface FinderFolderHistoryOptions {
  locationKey: string
  navigationType: NavigationType
  folderIds: string[]
}

export const areFolderIdsEqual = (firstIds: string[], secondIds: string[]) =>
  firstIds.length === secondIds.length &&
  firstIds.every((id, index) => id === secondIds[index])

const getBrowserHistoryState = () => {
  if (globalThis.window === undefined) {
    return undefined
  }
  const state = Schema.decodeUnknownResult(browserHistoryStateSchema)(
    window.history.state
  )
  return Result.isFailure(state) ? undefined : state.success
}

const syncBrowserHistoryOffset = () => {
  const state = getBrowserHistoryState()
  const { idx, [BROWSER_HISTORY_OFFSET_KEY]: offset } = state ?? {}
  if (idx === undefined) {
    return
  }
  if (offset !== undefined) {
    return
  }
  try {
    window.history.replaceState(
      {
        ...window.history.state,
        [BROWSER_HISTORY_OFFSET_KEY]: window.history.length - idx - 1,
      },
      ""
    )
  } catch {
    // A browser history implementation may reject non-cloneable state.
  }
}

const hasBrowserForwardEntry = (): boolean => {
  const state = getBrowserHistoryState()
  const { idx: historyIndex, [BROWSER_HISTORY_OFFSET_KEY]: historyOffset } =
    state ?? {}
  if (historyIndex === undefined || historyOffset === undefined) {
    return false
  }
  return historyIndex < window.history.length - historyOffset - 1
}

export const useFinderFolderHistory = ({
  locationKey,
  navigationType,
  folderIds,
}: FinderFolderHistoryOptions) => {
  const currentHistoryKeyRef = useRef(locationKey)
  const [entries, setEntries] = useState<FolderHistoryEntry[]>([
    { key: locationKey, folderIds },
  ])

  useEffect(() => {
    syncBrowserHistoryOffset()
    const currentEntry = { key: locationKey, folderIds }
    setEntries((currentEntries) => {
      const previousIndex = currentEntries.findIndex(
        (entry) => entry.key === currentHistoryKeyRef.current
      )

      if (navigationType === "PUSH") {
        const nextEntries = currentEntries.slice(0, previousIndex + 1)
        nextEntries.push(currentEntry)
        return nextEntries
      }
      if (navigationType === "REPLACE") {
        if (previousIndex === -1) {
          return [currentEntry]
        }
        const nextEntries = currentEntries.slice()
        nextEntries[previousIndex] = currentEntry
        return nextEntries
      }
      return currentEntries.some((entry) => entry.key === locationKey)
        ? currentEntries.slice()
        : [currentEntry]
    })
    currentHistoryKeyRef.current = locationKey
  }, [folderIds, locationKey, navigationType])

  return useMemo(() => {
    const currentIndex = entries.findIndex((entry) => entry.key === locationKey)
    return {
      previousFolderIds:
        currentIndex > 0 ? entries[currentIndex - 1]?.folderIds : undefined,
      forwardFolderIds:
        currentIndex === -1 ? undefined : entries[currentIndex + 1]?.folderIds,
      hasBrowserForwardEntry: hasBrowserForwardEntry(),
    }
  }, [entries, locationKey])
}

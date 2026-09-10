import { useEffect, useRef, type RefObject } from "react"
import { Result, Schema } from "effect"

const scrollPositionsSchema = Schema.Record(Schema.String, Schema.Number)

interface UseFinderScrollRestorationOptions {
  contentRef: RefObject<HTMLDivElement | null>
  currentFolderKey: string
  storageKey?: string
}

export const useFinderScrollRestoration = ({
  contentRef,
  currentFolderKey,
  storageKey,
}: UseFinderScrollRestorationOptions) => {
  const scrollPositionsRef = useRef(new Map<string, number>())

  useEffect(() => {
    if (!storageKey || globalThis.window === undefined) {
      return
    }
    try {
      const storedPositions = Schema.decodeUnknownResult(scrollPositionsSchema)(
        JSON.parse(window.sessionStorage.getItem(storageKey) ?? "{}")
      )
      if (Result.isFailure(storedPositions)) {
        return
      }
      for (const [folderKey, position] of Object.entries(
        storedPositions.success
      )) {
        scrollPositionsRef.current.set(folderKey, position)
      }
    } catch {
      // A blocked or malformed browser cache should not affect navigation.
    }
  }, [storageKey])

  useEffect(() => {
    contentRef.current?.scrollTo({
      top: scrollPositionsRef.current.get(currentFolderKey) ?? 0,
    })
  }, [contentRef, currentFolderKey])

  const rememberScrollPosition = () => {
    const position = contentRef.current?.scrollTop ?? 0
    scrollPositionsRef.current.set(currentFolderKey, position)
    if (!storageKey || globalThis.window === undefined) {
      return
    }
    try {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify(Object.fromEntries(scrollPositionsRef.current))
      )
    } catch {
      // A full or blocked browser cache should not affect navigation.
    }
  }

  return { rememberScrollPosition }
}

import { useEffect, useRef, type RefObject } from "react"

interface UseFinderScrollRestorationOptions {
  contentRef: RefObject<HTMLDivElement | null>
  currentFolderKey: string
}

export const useFinderScrollRestoration = ({
  contentRef,
  currentFolderKey,
}: UseFinderScrollRestorationOptions) => {
  const scrollPositionsRef = useRef(new Map<string, number>())

  useEffect(() => {
    contentRef.current?.scrollTo({
      top: scrollPositionsRef.current.get(currentFolderKey) ?? 0,
    })
  }, [contentRef, currentFolderKey])

  const rememberScrollPosition = () => {
    scrollPositionsRef.current.set(
      currentFolderKey,
      contentRef.current?.scrollTop ?? 0
    )
  }

  return { rememberScrollPosition }
}

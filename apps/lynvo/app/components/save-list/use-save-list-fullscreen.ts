import { useCallback, useEffect, useRef } from "react"
import { useLocation } from "react-router"

interface SaveListLocationState {
  readonly lynvoSaveListScrollPosition?: number
}

export const getSaveListScrollPosition = (
  state: SaveListLocationState | null | undefined
): number | undefined => {
  const scrollPosition = state?.lynvoSaveListScrollPosition
  return Number.isFinite(scrollPosition) ? scrollPosition : undefined
}

export const createSaveListScrollLocationState = (
  scrollPosition: number
): SaveListLocationState => ({
  lynvoSaveListScrollPosition: scrollPosition,
})

export const useSaveListFullscreen = (isFullscreen: boolean) => {
  const location = useLocation()
  const restoredScrollPosition = getSaveListScrollPosition(location.state)
  const pageScrollPositionRef = useRef(restoredScrollPosition ?? 0)

  // Keep the last Library position for history navigation and restored routes
  // that do not pass through the click handlers.
  const rememberScrollPosition = useCallback(() => {
    if (!isFullscreen) {
      pageScrollPositionRef.current = window.scrollY
    }
    return pageScrollPositionRef.current
  }, [isFullscreen])

  useEffect(() => {
    if (restoredScrollPosition !== undefined) {
      pageScrollPositionRef.current = restoredScrollPosition
    }
    if (!isFullscreen) {
      delete document.body.dataset.saveListFullscreen
      rememberScrollPosition()
      window.addEventListener("scroll", rememberScrollPosition, {
        passive: true,
      })
      return () => window.removeEventListener("scroll", rememberScrollPosition)
    }

    const previousBodyOverflow = document.body.style.overflow
    document.body.dataset.saveListFullscreen = "true"
    document.body.style.overflow = "hidden"
    window.scrollTo(0, 0)

    return () => {
      delete document.body.dataset.saveListFullscreen
      document.body.style.overflow = previousBodyOverflow
      // Runs after React Router's own scroll handling for the exit
      // navigation, so this restore has the final say.
      window.scrollTo(0, pageScrollPositionRef.current)
    }
  }, [isFullscreen, rememberScrollPosition, restoredScrollPosition])

  return { rememberScrollPosition }
}

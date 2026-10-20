import { Result, Schema } from "effect"
import { useCallback, useEffect, useRef } from "react"

import { savePaths } from "~/lib/paths"

interface SaveListLocationState {
  readonly lynvoSaveListScrollPosition?: number
  readonly lynvoSaveListReturnTo?: string
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

/** The saved-list page a folder was opened from, so Back returns there. */
export const getSaveListReturnTo = (
  state: SaveListLocationState | null | undefined
): string | undefined => {
  // SAFETY: history state is untrusted navigation input, decoded here at its
  // boundary like every other external value.
  const decoded = Schema.decodeUnknownResult(Schema.String)(
    state?.lynvoSaveListReturnTo
  )
  if (Result.isFailure(decoded)) {
    return undefined
  }
  const returnTo = decoded.success
  return returnTo.startsWith(savePaths.root) ? returnTo : undefined
}

export const useSaveListFullscreen = (
  isFullscreen: boolean,
  restoredScrollPosition?: number
) => {
  const pageScrollPositionRef = useRef(restoredScrollPosition ?? 0)

  // Keep the last Library position for history navigation and restored routes
  // that do not pass through the click handlers.
  const rememberScrollPosition = useCallback(() => {
    if (!isFullscreen) {
      pageScrollPositionRef.current = window.scrollY
    }
  }, [isFullscreen])
  const getRememberedScrollPosition = useCallback(
    () => pageScrollPositionRef.current,
    []
  )

  useEffect(() => {
    if (restoredScrollPosition !== undefined) {
      pageScrollPositionRef.current = restoredScrollPosition
    }
    if (!isFullscreen) {
      rememberScrollPosition()
      window.addEventListener("scroll", rememberScrollPosition, {
        passive: true,
      })
      return () => window.removeEventListener("scroll", rememberScrollPosition)
    }

    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.scrollTo(0, 0)

    return () => {
      document.body.style.overflow = previousBodyOverflow
      // Runs after React Router's own scroll handling for the exit
      // navigation, so this restore has the final say.
      window.scrollTo(0, pageScrollPositionRef.current)
    }
  }, [isFullscreen, rememberScrollPosition, restoredScrollPosition])

  return { getRememberedScrollPosition, rememberScrollPosition }
}

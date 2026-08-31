import { useEffect, useEffectEvent, useRef, type RefObject } from "react"
import {
  getFinderWheelGestureUpdate,
  RESET_FINDER_WHEEL_GESTURE_STATE,
  type FinderWheelGestureState,
} from "./finder-wheel-gesture"

interface UseFinderWheelNavigationOptions {
  contentRef: RefObject<HTMLDivElement | null>
  hasForwardFolderPaths: boolean
  hasNoRootLinks: boolean
  navigateToParentFolder: () => void
  navigateToNextFolder: () => void
}

export const useFinderWheelNavigation = ({
  contentRef,
  hasForwardFolderPaths,
  hasNoRootLinks,
  navigateToParentFolder,
  navigateToNextFolder,
}: UseFinderWheelNavigationOptions) => {
  const gestureStateRef = useRef<FinderWheelGestureState>(
    RESET_FINDER_WHEEL_GESTURE_STATE
  )

  const resetHorizontalGesture = () => {
    gestureStateRef.current = RESET_FINDER_WHEEL_GESTURE_STATE
  }

  const handleContentWheel = useEffectEvent((event: WheelEvent) => {
    const gestureUpdate = getFinderWheelGestureUpdate({
      currentState: gestureStateRef.current,
      event,
      currentTimeMs: Date.now(),
      hasForwardFolderPaths,
    })
    gestureStateRef.current = gestureUpdate.nextState
    if (gestureUpdate.shouldPreventDefault) {
      event.preventDefault()
    }
    if (gestureUpdate.navigation === "parent-folder") {
      navigateToParentFolder()
    } else if (gestureUpdate.navigation === "next-folder") {
      navigateToNextFolder()
    }
  })

  useEffect(() => {
    const contentElement = contentRef.current
    if (!contentElement) {
      return
    }
    const handleNativeWheel = (event: WheelEvent) => {
      handleContentWheel(event)
    }
    contentElement.addEventListener("wheel", handleNativeWheel, {
      passive: false,
    })
    return () => contentElement.removeEventListener("wheel", handleNativeWheel)
  }, [contentRef, hasNoRootLinks])

  return { resetHorizontalGesture }
}

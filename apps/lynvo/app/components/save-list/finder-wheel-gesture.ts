import {
  FINDER_NAVIGATION_GESTURE_RESET_DELAY_MS,
  FINDER_NAVIGATION_GESTURE_TRIGGER_DISTANCE_PX,
} from "~/lib/constants"

export interface FinderWheelGestureState {
  accumulatedDistancePx: number
  didTrigger: boolean
  lastGestureWasBack: boolean | null
  lastGestureEventAtMs: number
}

export interface FinderWheelGestureUpdate {
  nextState: FinderWheelGestureState
  shouldPreventDefault: boolean
  navigation: "parent-folder" | "next-folder" | null
}

export interface FinderWheelGestureInput {
  currentState: FinderWheelGestureState
  event: WheelEvent
  currentTimeMs: number
  hasForwardFolderPaths: boolean
}

export const RESET_FINDER_WHEEL_GESTURE_STATE: FinderWheelGestureState = {
  accumulatedDistancePx: 0,
  didTrigger: false,
  lastGestureWasBack: null,
  lastGestureEventAtMs: 0,
}

export const getFinderWheelGestureUpdate = ({
  currentState,
  event,
  currentTimeMs,
  hasForwardFolderPaths,
}: FinderWheelGestureInput): FinderWheelGestureUpdate => {
  const isIdleGesture =
    currentTimeMs - currentState.lastGestureEventAtMs >
    FINDER_NAVIGATION_GESTURE_RESET_DELAY_MS
  let gestureState = isIdleGesture
    ? RESET_FINDER_WHEEL_GESTURE_STATE
    : currentState

  const isHorizontalGesture = Math.abs(event.deltaX) > Math.abs(event.deltaY)
  if (!isHorizontalGesture || event.deltaX === 0) {
    return {
      nextState: RESET_FINDER_WHEEL_GESTURE_STATE,
      shouldPreventDefault: false,
      navigation: null,
    }
  }

  const isBackGesture = event.deltaX < 0
  if (
    gestureState.lastGestureWasBack !== null &&
    gestureState.lastGestureWasBack !== isBackGesture
  ) {
    gestureState = RESET_FINDER_WHEEL_GESTURE_STATE
  }

  if (!isBackGesture && !hasForwardFolderPaths) {
    return {
      nextState: RESET_FINDER_WHEEL_GESTURE_STATE,
      shouldPreventDefault: false,
      navigation: null,
    }
  }

  if (gestureState.didTrigger) {
    return {
      nextState: {
        accumulatedDistancePx: gestureState.accumulatedDistancePx,
        didTrigger: true,
        lastGestureWasBack: isBackGesture,
        lastGestureEventAtMs: currentTimeMs,
      },
      shouldPreventDefault: true,
      navigation: null,
    }
  }

  const accumulatedDistancePx =
    gestureState.accumulatedDistancePx + Math.abs(event.deltaX)
  if (accumulatedDistancePx < FINDER_NAVIGATION_GESTURE_TRIGGER_DISTANCE_PX) {
    return {
      nextState: {
        accumulatedDistancePx,
        didTrigger: false,
        lastGestureWasBack: isBackGesture,
        lastGestureEventAtMs: currentTimeMs,
      },
      shouldPreventDefault: true,
      navigation: null,
    }
  }

  return {
    nextState: {
      accumulatedDistancePx: 0,
      didTrigger: true,
      lastGestureWasBack: isBackGesture,
      lastGestureEventAtMs: currentTimeMs,
    },
    shouldPreventDefault: true,
    navigation: isBackGesture ? "parent-folder" : "next-folder",
  }
}

import {
  useCallback,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import {
  CARD_MENU_LONG_PRESS_DURATION_MS,
  CARD_MENU_LONG_PRESS_MOVEMENT_TOLERANCE_PX,
} from "~/lib/constants"

interface LongPressOptions {
  readonly enabled: boolean
  readonly onLongPress: () => void
}

interface LongPressHandlers {
  readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  readonly onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  readonly onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  readonly onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void
  readonly onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void
}

interface LongPressControls {
  readonly longPressHandlers: LongPressHandlers
  readonly consumeLongPress: () => boolean
}

export const useLongPress = ({
  enabled,
  onLongPress,
}: LongPressOptions): LongPressControls => {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pointerId = useRef<number | undefined>(undefined)
  const startPosition = useRef<{ x: number; y: number } | undefined>(undefined)
  const didLongPress = useRef(false)
  const onLongPressRef = useRef(onLongPress)
  onLongPressRef.current = onLongPress

  const cancel = useCallback((event?: ReactPointerEvent<HTMLElement>) => {
    if (timer.current !== undefined) {
      clearTimeout(timer.current)
      timer.current = undefined
    }
    if (
      event &&
      pointerId.current !== undefined &&
      event.currentTarget.hasPointerCapture(pointerId.current)
    ) {
      event.currentTarget.releasePointerCapture(pointerId.current)
    }
    pointerId.current = undefined
    startPosition.current = undefined
  }, [])

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (
        !enabled ||
        (event.pointerType !== "touch" && event.pointerType !== "pen")
      ) {
        return
      }
      cancel()
      didLongPress.current = false
      pointerId.current = event.pointerId
      startPosition.current = { x: event.clientX, y: event.clientY }
      event.currentTarget.setPointerCapture(event.pointerId)
      timer.current = setTimeout(() => {
        timer.current = undefined
        didLongPress.current = true
        onLongPressRef.current()
      }, CARD_MENU_LONG_PRESS_DURATION_MS)
    },
    [cancel, enabled]
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const start = startPosition.current
      if (!start || event.pointerId !== pointerId.current) {
        return
      }
      if (
        Math.hypot(event.clientX - start.x, event.clientY - start.y) >
        CARD_MENU_LONG_PRESS_MOVEMENT_TOLERANCE_PX
      ) {
        cancel(event)
      }
    },
    [cancel]
  )

  const onPointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => cancel(event),
    [cancel]
  )

  const onContextMenu = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (pointerId.current !== undefined || didLongPress.current) {
      event.preventDefault()
    }
  }, [])

  const consumeLongPress = useCallback((): boolean => {
    const shouldConsume = didLongPress.current
    didLongPress.current = false
    return shouldConsume
  }, [])

  return {
    longPressHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onContextMenu,
    },
    consumeLongPress,
  }
}

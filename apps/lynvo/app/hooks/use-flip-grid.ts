import { useLayoutEffect, useRef, type RefObject } from "react"
import { SAVE_GRID_CARD_SHIFT_DURATION_MS } from "~/lib/constants"

interface UseFlipGridOptions {
  readonly containerRef: RefObject<HTMLElement | null>
  readonly dependency: unknown
}

export const useFlipGrid = ({
  containerRef,
  dependency,
}: UseFlipGridOptions): void => {
  const elementPositionsRef = useRef(new Map<string, DOMRect>())

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    const prefersReducedMotion = Boolean(
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    )
    const previousPositions = elementPositionsRef.current
    const nextPositions = new Map<string, DOMRect>()
    const animatedElements: HTMLElement[] = []

    for (const child of Array.from(container.children)) {
      if (!(child instanceof HTMLElement)) {
        continue
      }
      const flipKey = child.dataset.flipKey
      if (!flipKey) {
        continue
      }
      child.style.transition = ""
      child.style.transform = ""
      const nextPosition = child.getBoundingClientRect()
      nextPositions.set(flipKey, nextPosition)
      if (prefersReducedMotion) {
        continue
      }
      const previousPosition = previousPositions.get(flipKey)
      if (!previousPosition) {
        continue
      }
      const deltaX = previousPosition.left - nextPosition.left
      const deltaY = previousPosition.top - nextPosition.top
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        continue
      }
      child.style.transition = "none"
      child.style.transform = `translate(${deltaX}px, ${deltaY}px)`
      animatedElements.push(child)
    }

    elementPositionsRef.current = nextPositions
    if (animatedElements.length === 0) {
      return
    }

    const animationFrameId = requestAnimationFrame(() => {
      for (const element of animatedElements) {
        element.style.transition = `transform ${SAVE_GRID_CARD_SHIFT_DURATION_MS}ms ease`
        element.style.transform = ""
      }
    })
    return () => {
      cancelAnimationFrame(animationFrameId)
      for (const element of animatedElements) {
        element.style.transition = ""
        element.style.transform = ""
      }
    }
  }, [containerRef, dependency])
}

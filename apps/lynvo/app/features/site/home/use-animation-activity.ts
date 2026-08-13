import { useEffect, useRef, useState, type RefObject } from "react"

interface AnimationActivity<ElementType extends HTMLElement> {
  animationContainerRef: RefObject<ElementType | null>
  isAnimationActive: boolean
}

export const useAnimationActivity = <
  ElementType extends HTMLElement,
>(): AnimationActivity<ElementType> => {
  const animationContainerRef = useRef<ElementType>(null)
  const [isInViewport, setIsInViewport] = useState(true)
  const [isPageVisible, setIsPageVisible] = useState(
    () =>
      globalThis.document === undefined ||
      document.visibilityState === "visible"
  )

  useEffect(() => {
    const updatePageVisibility = () =>
      setIsPageVisible(document.visibilityState === "visible")

    updatePageVisibility()
    document.addEventListener("visibilitychange", updatePageVisibility)

    const animationContainer = animationContainerRef.current
    if (!animationContainer || globalThis.IntersectionObserver === undefined) {
      return () =>
        document.removeEventListener("visibilitychange", updatePageVisibility)
    }

    const intersectionObserver = new IntersectionObserver(([entry]) =>
      setIsInViewport(Boolean(entry?.isIntersecting))
    )
    intersectionObserver.observe(animationContainer)

    return () => {
      intersectionObserver.disconnect()
      document.removeEventListener("visibilitychange", updatePageVisibility)
    }
  }, [])

  return {
    animationContainerRef,
    isAnimationActive: isInViewport && isPageVisible,
  }
}

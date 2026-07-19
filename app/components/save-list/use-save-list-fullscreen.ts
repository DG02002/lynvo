import { useEffect, useRef } from "react"

export const useSaveListFullscreen = (isFullscreen: boolean) => {
  const pageScrollPositionRef = useRef(0)

  useEffect(() => {
    if (!isFullscreen) {
      delete document.body.dataset.saveListFullscreen
      return
    }

    pageScrollPositionRef.current = window.scrollY
    const previousBodyOverflow = document.body.style.overflow
    document.body.dataset.saveListFullscreen = "true"
    document.body.style.overflow = "hidden"
    window.scrollTo(0, 0)

    return () => {
      delete document.body.dataset.saveListFullscreen
      document.body.style.overflow = previousBodyOverflow
      window.scrollTo(0, pageScrollPositionRef.current)
    }
  }, [isFullscreen])
}

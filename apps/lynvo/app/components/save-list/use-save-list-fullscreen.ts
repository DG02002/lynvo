import { useEffect, useRef } from "react"

export const useSaveListFullscreen = (isFullscreen: boolean) => {
  const pageScrollPositionRef = useRef(0)

  // The gallery position must be captured while the page still holds it.
  // By the time the fullscreen effect below runs, React Router has already
  // reset the window scroll and the immersive layout has collapsed the
  // document, so window.scrollY reads 0 there. Callers capture at the
  // moment an immersive view opens instead.
  const rememberScrollPosition = () => {
    pageScrollPositionRef.current = window.scrollY
  }

  useEffect(() => {
    if (!isFullscreen) {
      delete document.body.dataset.saveListFullscreen
      return undefined
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
  }, [isFullscreen])

  return { rememberScrollPosition }
}

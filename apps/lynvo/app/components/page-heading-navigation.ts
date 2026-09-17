import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type MouseEvent,
  type SetStateAction,
} from "react"
import { DOCS_SCROLL_END_TOLERANCE_PX } from "~/lib/constants"

export interface PageHeading {
  readonly id: string
  readonly label: string
  readonly level?: 3
}

export const useDocumentHeadings = (
  providedHeadings: readonly PageHeading[] | undefined,
  targetId: string | undefined
): readonly PageHeading[] => {
  const [discoveredHeadings, setDiscoveredHeadings] = useState<
    readonly PageHeading[]
  >([])

  useEffect(() => {
    if (providedHeadings) {
      return undefined
    }

    const target = targetId ? document.getElementById(targetId) : null
    if (!target) {
      return undefined
    }

    const discoverHeadings = () => {
      const nextHeadings = Array.from(
        target.querySelectorAll<HTMLElement>("h2[id], h3[id]")
      ).map((heading) => ({
        id: heading.id,
        label: heading.textContent?.trim() ?? heading.id,
        level: heading.tagName === "H3" ? (3 as const) : undefined,
      }))

      setDiscoveredHeadings(nextHeadings)
    }

    discoverHeadings()
    const observer = new MutationObserver(discoverHeadings)
    observer.observe(target, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [providedHeadings, targetId])

  return providedHeadings ?? discoveredHeadings
}

export const useActiveHeadingTracker = (
  headings: readonly PageHeading[],
  getScrollOffset: () => number
): readonly [
  activeHeadingId: string,
  setActiveHeadingId: Dispatch<SetStateAction<string>>,
] => {
  const [activeHeadingId, setActiveHeadingId] = useState(headings[0]?.id ?? "")

  useEffect(() => {
    if (headings.length === 0) {
      return undefined
    }

    let animationFrameId: number | undefined

    const updateActiveHeading = () => {
      animationFrameId = undefined
      const headingElements = headings.flatMap((heading) => {
        const headingElement = document.getElementById(heading.id)
        return headingElement ? [headingElement] : []
      })

      if (headingElements.length === 0) {
        return
      }

      let nextActiveHeadingId = headingElements[0].id
      for (const headingElement of headingElements) {
        if (headingElement.getBoundingClientRect().top <= getScrollOffset()) {
          nextActiveHeadingId = headingElement.id
        } else {
          break
        }
      }

      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - DOCS_SCROLL_END_TOLERANCE_PX
      ) {
        nextActiveHeadingId = headingElements.at(-1)?.id ?? nextActiveHeadingId
      }

      setActiveHeadingId((currentHeadingId) =>
        currentHeadingId === nextActiveHeadingId
          ? currentHeadingId
          : nextActiveHeadingId
      )
    }

    const requestUpdate = () => {
      if (animationFrameId === undefined) {
        animationFrameId = window.requestAnimationFrame(updateActiveHeading)
      }
    }

    requestUpdate()
    window.addEventListener("scroll", requestUpdate, { passive: true })
    window.addEventListener("resize", requestUpdate)

    return () => {
      window.removeEventListener("scroll", requestUpdate)
      window.removeEventListener("resize", requestUpdate)
      if (animationFrameId !== undefined) {
        window.cancelAnimationFrame(animationFrameId)
      }
    }
  }, [getScrollOffset, headings])

  // An id that no longer exists in the headings falls back to the first one.
  const trackedActiveHeadingId = headings.some(
    (heading) => heading.id === activeHeadingId
  )
    ? activeHeadingId
    : (headings[0]?.id ?? "")

  return [trackedActiveHeadingId, setActiveHeadingId]
}

export const useHeadingClickHandler = (
  setActiveHeadingId: Dispatch<SetStateAction<string>>,
  onSelect?: () => void
) =>
  useCallback(
    (event: MouseEvent<HTMLAnchorElement>, headingId: string) => {
      const headingElement = document.getElementById(headingId)
      if (!headingElement) {
        return
      }

      event.preventDefault()
      setActiveHeadingId(headingId)
      onSelect?.()
      headingElement.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      })
      window.history.pushState(null, "", `#${headingId}`)
    },
    [onSelect, setActiveHeadingId]
  )

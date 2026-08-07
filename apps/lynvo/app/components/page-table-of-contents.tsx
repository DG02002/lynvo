import { useEffect, useRef, useState } from "react"
import type { MouseEvent } from "react"

import {
  DOCS_SCROLL_END_TOLERANCE_PX,
  DOCS_SCROLL_OFFSET_PX,
} from "~/lib/constants"
import { cn } from "~/lib/utils"
import { getScrollAdjustment } from "./page-table-of-contents-utils"

interface PageTableOfContentsHeading {
  id: string
  label: string
  level?: 3
}

export function PageTableOfContents({
  className,
  headings: providedHeadings,
  targetId,
  variant = "docs",
}: {
  className?: string
  headings?: readonly PageTableOfContentsHeading[]
  targetId?: string
  variant?: "docs" | "policy"
}) {
  const navigationRef = useRef<HTMLElement>(null)
  const [headings, setHeadings] = useState<
    readonly PageTableOfContentsHeading[]
  >(providedHeadings ?? [])
  const [activeHeadingId, setActiveHeadingId] = useState(
    providedHeadings?.[0]?.id ?? ""
  )

  useEffect(() => {
    if (providedHeadings) {
      setHeadings(providedHeadings)
      setActiveHeadingId(providedHeadings[0]?.id ?? "")
      return
    }

    const target = targetId ? document.getElementById(targetId) : null
    if (!target) {
      return
    }

    const discoverHeadings = () => {
      const discoveredHeadings = Array.from(
        target.querySelectorAll<HTMLElement>("h2[id], h3[id]")
      ).map((heading) => ({
        id: heading.id,
        label: heading.textContent?.trim() ?? heading.id,
        level: heading.tagName === "H3" ? (3 as const) : undefined,
      }))

      setHeadings(discoveredHeadings)
      setActiveHeadingId((currentId) =>
        discoveredHeadings.some((heading) => heading.id === currentId)
          ? currentId
          : (discoveredHeadings[0]?.id ?? "")
      )
    }

    discoverHeadings()
    const observer = new MutationObserver(discoverHeadings)
    observer.observe(target, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [providedHeadings, targetId])

  useEffect(() => {
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
        if (
          headingElement.getBoundingClientRect().top <= DOCS_SCROLL_OFFSET_PX
        ) {
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
  }, [headings])

  useEffect(() => {
    const navigation = navigationRef.current
    const scrollContainer = navigation?.parentElement
    const activeLink = navigation?.querySelector<HTMLElement>(
      '[aria-current="location"]'
    )
    if (!scrollContainer || !activeLink) {
      return
    }

    const containerRect = scrollContainer.getBoundingClientRect()
    const itemRect = activeLink.getBoundingClientRect()
    scrollContainer.scrollTop += getScrollAdjustment({
      containerBottom: containerRect.bottom,
      containerTop: containerRect.top,
      itemBottom: itemRect.bottom,
      itemTop: itemRect.top,
    })
  }, [activeHeadingId])

  const handleHeadingClick = (
    event: MouseEvent<HTMLAnchorElement>,
    headingId: string
  ) => {
    const headingElement = document.getElementById(headingId)
    if (!headingElement) {
      return
    }

    event.preventDefault()
    setActiveHeadingId(headingId)
    headingElement.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    })
    window.history.pushState(null, "", `#${headingId}`)
  }

  return (
    <nav
      ref={navigationRef}
      aria-label="On this page"
      className={cn(
        "flex flex-col",
        variant === "docs" && "gap-3 px-4",
        className
      )}
    >
      {variant === "docs" && (
        <p className="text-lg font-normal tracking-tight text-foreground">
          On this page
        </p>
      )}
      <ul
        className={cn("flex flex-col", variant === "docs" ? "gap-1" : "gap-4")}
      >
        {headings.map((heading) => {
          const isActive = heading.id === activeHeadingId

          return (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                aria-current={isActive ? "location" : undefined}
                onClick={(event) => handleHeadingClick(event, heading.id)}
                className={cn(
                  variant === "docs"
                    ? "block rounded-lg px-4 py-3 text-[0.9375rem] font-normal leading-6 transition-[color,background-color]"
                    : "block text-xs font-normal leading-5 transition-colors",
                  heading.level === 3 &&
                    (variant === "docs" ? "ml-3 text-sm" : "pl-4"),
                  variant === "docs"
                    ? isActive
                      ? "bg-muted text-blue-500 dark:text-blue-400"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    : isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                )}
              >
                {heading.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

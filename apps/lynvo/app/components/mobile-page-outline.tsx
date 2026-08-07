import { useEffect, useId, useState } from "react"
import type { MouseEvent } from "react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { DOCS_SCROLL_END_TOLERANCE_PX } from "~/lib/constants"
import { cn } from "~/lib/utils"

const getHeaderHeight = () => (window.innerWidth >= 768 ? 64 : 56)
const getOutlineScrollOffset = () => (window.innerWidth >= 768 ? 112 : 96)

interface PageOutlineHeading {
  id: string
  label: string
  level?: 3
}

export function MobilePageOutline({
  className,
  headings: providedHeadings,
  revealAfterSelector,
  targetId,
}: {
  className?: string
  headings?: readonly PageOutlineHeading[]
  revealAfterSelector?: string
  targetId?: string
}) {
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(!revealAfterSelector)
  const [headings, setHeadings] = useState<readonly PageOutlineHeading[]>(
    providedHeadings ?? []
  )
  const [activeHeadingId, setActiveHeadingId] = useState(
    providedHeadings?.[0]?.id ?? ""
  )

  useEffect(() => {
    if (providedHeadings) {
      setHeadings(providedHeadings)
      setActiveHeadingId(
        (currentId) => currentId || providedHeadings[0]?.id || ""
      )
      return
    }

    const target = targetId ? document.getElementById(targetId) : null
    if (!target) {
      return
    }

    const discoveredHeadings = Array.from(
      target.querySelectorAll<HTMLElement>("h2[id], h3[id]")
    ).map((heading) => ({
      id: heading.id,
      label: heading.textContent?.trim() ?? heading.id,
      level: heading.tagName === "H3" ? (3 as const) : undefined,
    }))

    setHeadings(discoveredHeadings)
    setActiveHeadingId(discoveredHeadings[0]?.id ?? "")
  }, [providedHeadings, targetId])

  useEffect(() => {
    if (!revealAfterSelector) {
      setVisible(true)
      return
    }

    let animationFrameId: number | undefined

    const updateVisibility = () => {
      animationFrameId = undefined
      const revealAfter = document.querySelector(revealAfterSelector)
      const nextVisible =
        revealAfter instanceof HTMLElement &&
        revealAfter.getBoundingClientRect().bottom <= getHeaderHeight()

      setVisible(nextVisible)
      if (!nextVisible) {
        setOpen(false)
      }
    }

    const requestUpdate = () => {
      if (animationFrameId === undefined) {
        animationFrameId = window.requestAnimationFrame(updateVisibility)
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
  }, [revealAfterSelector])

  useEffect(() => {
    if (headings.length === 0) {
      return
    }

    let animationFrameId: number | undefined

    const updateActiveHeading = () => {
      animationFrameId = undefined
      const headingElements = headings.flatMap((heading) => {
        const element = document.getElementById(heading.id)
        return element ? [element] : []
      })

      if (headingElements.length === 0) {
        return
      }

      let nextId = headingElements[0].id
      for (const heading of headingElements) {
        if (heading.getBoundingClientRect().top <= getOutlineScrollOffset()) {
          nextId = heading.id
        } else {
          break
        }
      }

      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - DOCS_SCROLL_END_TOLERANCE_PX
      ) {
        nextId = headingElements.at(-1)?.id ?? nextId
      }

      setActiveHeadingId((currentId) =>
        currentId === nextId ? currentId : nextId
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

  if (headings.length === 0) {
    return null
  }

  const activeHeading =
    headings.find((heading) => heading.id === activeHeadingId) ?? headings[0]

  const handleHeadingClick = (
    event: MouseEvent<HTMLAnchorElement>,
    headingId: string
  ) => {
    const heading = document.getElementById(headingId)
    if (!heading) {
      return
    }

    event.preventDefault()
    setActiveHeadingId(headingId)
    setOpen(false)
    heading.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    })
    window.history.pushState(null, "", `#${headingId}`)
  }

  return (
    <nav
      aria-label="On this page"
      className={cn(
        "sticky top-14 z-40 -mx-6 -mb-10 h-10 md:top-16 md:-mx-8 md:-mb-12 md:h-12",
        className
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        tabIndex={visible ? undefined : -1}
        onClick={() => visible && setOpen((current) => !current)}
        className={cn(
          "flex min-h-10 w-full items-center justify-between gap-4 border-b bg-background/95 px-6 text-left text-xs font-normal backdrop-blur-xl transition-[color,background-color,opacity] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)] hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring active:bg-muted/60 md:min-h-12 md:px-8",
          visible ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <span className="truncate">{activeHeading.label}</span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 transition-transform duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
            open && "rotate-180"
          )}
          strokeWidth={2}
        />
      </button>

      <div
        id={panelId}
        aria-hidden={!open}
        className={cn(
          "absolute inset-x-0 top-full border-b bg-background/98 shadow-xl backdrop-blur-xl transition-opacity duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)]",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <div className="overflow-y-auto overscroll-contain">
          <ul className="flex max-h-[min(65svh,32rem)] flex-col px-6 py-3 md:px-8 md:py-4">
            {headings.map((heading) => {
              const active = heading.id === activeHeading.id

              return (
                <li key={heading.id}>
                  <a
                    href={`#${heading.id}`}
                    aria-current={active ? "location" : undefined}
                    tabIndex={open ? undefined : -1}
                    onClick={(event) => handleHeadingClick(event, heading.id)}
                    className={cn(
                      "flex min-h-10 items-center rounded-lg py-1.5 text-xs transition-[color,background-color,scale] duration-150 active:scale-[0.98] md:min-h-11 md:py-2",
                      heading.level === 3 ? "pl-5" : "px-3",
                      active
                        ? "text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    {heading.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </nav>
  )
}

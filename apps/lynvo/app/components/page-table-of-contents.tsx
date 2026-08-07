import { useEffect, useState } from "react"
import type { MouseEvent } from "react"

import {
  DOCS_SCROLL_END_TOLERANCE_PX,
  DOCS_SCROLL_OFFSET_PX,
} from "~/lib/constants"
import { cn } from "~/lib/utils"

interface PageTableOfContentsHeading {
  id: string
  label: string
  level?: 3
}

export function PageTableOfContents({
  className,
  headings,
  variant = "docs",
}: {
  className?: string
  headings: readonly PageTableOfContentsHeading[]
  variant?: "docs" | "policy"
}) {
  const [activeHeadingId, setActiveHeadingId] = useState(headings[0]?.id ?? "")

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
      aria-label="On this page"
      className={cn(
        "flex flex-col",
        variant === "docs" && "gap-3 px-4",
        className
      )}
    >
      {variant === "docs" && (
        <p className="text-xs font-medium text-muted-foreground">
          On this page
        </p>
      )}
      <ul
        className={cn("flex flex-col", variant === "docs" ? "gap-2" : "gap-4")}
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
                  "block text-xs font-normal leading-5 transition-colors",
                  heading.level === 3 && "pl-4",
                  isActive
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

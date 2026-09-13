import { useEffect, useRef } from "react"

import { DOCS_SCROLL_OFFSET_PX } from "~/lib/constants"
import { cn } from "~/lib/utils"
import {
  useActiveHeadingTracker,
  useDocumentHeadings,
  useHeadingClickHandler,
  type PageHeading,
} from "./page-heading-navigation"
import { getScrollAdjustment } from "./page-table-of-contents-utils"

const getTableOfContentsLinkClassName = (
  variant: "docs" | "policy",
  heading: PageHeading,
  isActive: boolean
): string => {
  const variantClassName =
    variant === "docs"
      ? "block rounded-lg px-4 py-3 text-[0.9375rem] font-normal leading-6 transition-[color,background-color]"
      : "block text-xs font-normal leading-5 transition-colors"
  const levelClassName =
    heading.level === 3 && (variant === "docs" ? "ml-3 text-sm" : "pl-4")

  let activeClassName: string
  if (variant === "docs") {
    activeClassName = isActive
      ? "bg-muted text-blue-500 dark:text-blue-400"
      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
  } else {
    activeClassName = isActive
      ? "text-foreground"
      : "text-muted-foreground hover:text-foreground"
  }

  return cn(variantClassName, levelClassName, activeClassName)
}

const getDocsScrollOffset = () => DOCS_SCROLL_OFFSET_PX

export function PageTableOfContents({
  className,
  headings: providedHeadings,
  targetId,
  variant = "docs",
}: {
  className?: string
  headings?: readonly PageHeading[]
  targetId?: string
  variant?: "docs" | "policy"
}) {
  const navigationRef = useRef<HTMLElement>(null)
  const headings = useDocumentHeadings(providedHeadings, targetId)
  const [activeHeadingId, setActiveHeadingId] = useActiveHeadingTracker(
    headings,
    getDocsScrollOffset
  )
  const handleHeadingClick = useHeadingClickHandler(setActiveHeadingId)

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
                className={getTableOfContentsLinkClassName(
                  variant,
                  heading,
                  isActive
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

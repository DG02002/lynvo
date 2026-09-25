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
  // The docs variant draws its own left border on every item, forming the
  // vertical rail; nested headings step the rail to the right.
  const variantClassName =
    variant === "docs"
      ? "block border-l py-2 pr-2 pl-4 text-[0.9375rem] font-normal leading-5 transition-colors"
      : "block text-xs font-normal leading-5 transition-colors"
  const levelClassName =
    heading.level === 3 && (variant === "docs" ? "ml-3 pl-4 text-sm" : "pl-4")

  let activeClassName: string
  if (variant === "docs") {
    activeClassName = isActive
      ? "border-l-blue-500 text-foreground dark:border-l-blue-400"
      : "border-l-border text-muted-foreground hover:border-l-foreground/40 hover:text-foreground"
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
  }, [
    // The active heading changes aria-current and the link position in the
    // DOM, so the scroll adjustment must run when it changes.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
    activeHeadingId,
  ])

  return (
    <nav
      ref={navigationRef}
      aria-label="On this page"
      className={cn("flex flex-col", variant === "docs" && "gap-4", className)}
    >
      {variant === "docs" && (
        <p className="text-lg font-normal tracking-tight text-foreground">
          On this page
        </p>
      )}
      {/* The docs list keeps zero gap so the per-item left borders form one
          continuous rail; vertical rhythm comes from each item's padding. */}
      <ul className={cn("flex flex-col", variant === "policy" && "gap-4")}>
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

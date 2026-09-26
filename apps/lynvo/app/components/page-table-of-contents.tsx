import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react"

import { DOCS_SCROLL_OFFSET_PX } from "~/lib/constants"
import { cn } from "~/lib/utils"

import {
  useActiveHeadingTracker,
  useDocumentHeadings,
  useHeadingClickHandler,
  type PageHeading,
} from "./page-heading-navigation"
import {
  buildOutlineRail,
  getScrollAdjustment,
  type OutlineRailPaths,
  type OutlineRailRow,
} from "./page-table-of-contents-utils"

const OUTLINE_RAIL_STEP_PX = 18
const OUTLINE_RAIL_WIDTH_PX = OUTLINE_RAIL_STEP_PX + 4

const getTableOfContentsLinkClassName = (
  variant: "docs" | "policy",
  heading: PageHeading,
  isActive: boolean
): string => {
  // The docs variant reserves room for the SVG rail drawn behind the list;
  // nested headings shift right to line up with the rail's inner step.
  const variantClassName =
    variant === "docs"
      ? "block py-2 pr-2 pl-6 text-[0.9375rem] font-normal leading-5 transition-colors"
      : "block text-xs font-normal leading-5 transition-colors"
  const levelClassName =
    heading.level === 3 &&
    (variant === "docs" ? "ml-[18px] pl-6 text-sm" : "pl-4")

  const activeClassName = isActive
    ? "text-foreground"
    : "text-muted-foreground hover:text-foreground"

  return cn(variantClassName, levelClassName, activeClassName)
}

const getDocsScrollOffset = () => DOCS_SCROLL_OFFSET_PX

interface OutlineRailGeometry {
  height: number
  paths: OutlineRailPaths
}

const useOutlineRailGeometry = ({
  activeHeadingId,
  headings,
  listRef,
  variant,
}: {
  activeHeadingId: string
  headings: readonly PageHeading[]
  listRef: RefObject<HTMLUListElement | null>
  variant: "docs" | "policy"
}) => {
  const [geometry, setGeometry] = useState<OutlineRailGeometry>()

  useEffect(() => {
    const list = listRef.current
    if (!list || variant !== "docs" || headings.length === 0) {
      return undefined
    }

    const measureRail = () => {
      // The rail SVG is also a child of the list, so measure the list items.
      const items = Array.from(list.children).filter(
        (child): child is HTMLLIElement => child instanceof HTMLLIElement
      )
      const rows: OutlineRailRow[] = headings.map((heading, index) => {
        const item = items[index]
        const top = item?.offsetTop ?? 0
        return {
          bottom: item ? top + item.offsetHeight : 0,
          level: heading.level ?? 2,
          top,
        }
      })
      const activeRowIndex = headings.findIndex(
        (heading) => heading.id === activeHeadingId
      )
      const paths = buildOutlineRail(rows, activeRowIndex, OUTLINE_RAIL_STEP_PX)
      if (paths) {
        setGeometry({ height: list.offsetHeight, paths })
      }
    }

    measureRail()
    const observer = new ResizeObserver(measureRail)
    observer.observe(list)
    for (const item of Array.from(list.children)) {
      if (item instanceof HTMLElement) {
        observer.observe(item)
      }
    }
    return () => observer.disconnect()
  }, [activeHeadingId, headings, listRef, variant])

  return geometry
}

const getPathLengthAtY = (path: SVGPathElement, y: number, total: number) => {
  let lower = 0
  let upper = total
  for (let index = 0; index < 24; index += 1) {
    const middle = (lower + upper) / 2
    if (path.getPointAtLength(middle).y < y) {
      lower = middle
    } else {
      upper = middle
    }
  }
  return (lower + upper) / 2
}

function OutlineRail({ height, paths }: OutlineRailGeometry) {
  const activePathRef = useRef<SVGPathElement>(null)
  const [dash, setDash] = useState<{
    length: number
    offset: number
    total: number
  }>()

  useLayoutEffect(() => {
    const path = activePathRef.current
    if (!path) {
      return
    }
    const total = path.getTotalLength()
    const start = getPathLengthAtY(path, paths.activeSegment.top, total)
    const end = getPathLengthAtY(path, paths.activeSegment.bottom, total)
    setDash({ length: end - start, offset: -start, total })
  }, [paths])

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 overflow-visible"
      width={OUTLINE_RAIL_WIDTH_PX}
      height={height}
      viewBox={`0 0 ${OUTLINE_RAIL_WIDTH_PX} ${height}`}
      fill="none"
    >
      <path
        d={paths.basePath}
        className="stroke-border"
        strokeLinecap="butt"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      <path
        ref={activePathRef}
        d={paths.basePath}
        className="docs-outline-active stroke-blue-500 dark:stroke-blue-400"
        strokeDasharray={dash ? `${dash.length} ${dash.total}` : "0 1"}
        strokeDashoffset={dash?.offset ?? 0}
        strokeLinecap="butt"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  )
}

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
  const listRef = useRef<HTMLUListElement>(null)
  const headings = useDocumentHeadings(providedHeadings, targetId)
  const [activeHeadingId, setActiveHeadingId] = useActiveHeadingTracker(
    headings,
    getDocsScrollOffset
  )
  const handleHeadingClick = useHeadingClickHandler(setActiveHeadingId)
  const railGeometry = useOutlineRailGeometry({
    activeHeadingId,
    headings,
    listRef,
    variant,
  })

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
      {/* The docs list is the positioning context for the rail and keeps zero
          gap so the measured offsets stay continuous; vertical rhythm comes
          from each item's padding. */}
      <ul
        ref={listRef}
        className={cn(
          "relative flex flex-col",
          variant === "policy" && "gap-4"
        )}
      >
        {variant === "docs" && railGeometry && (
          <OutlineRail {...railGeometry} />
        )}
        {headings.map((heading, index) => {
          const isActive = heading.id === activeHeadingId
          const changesLevel =
            index > 0 &&
            (heading.level ?? 2) !== (headings[index - 1].level ?? 2)

          return (
            <li
              key={heading.id}
              className={
                variant === "docs" && changesLevel ? "mt-5" : undefined
              }
            >
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

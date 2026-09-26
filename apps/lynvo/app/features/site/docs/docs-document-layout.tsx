import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  ChevronRightIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ReactNode } from "react"
import { Link } from "react-router"

import { MobilePageOutline } from "~/components/mobile-page-outline"
import { PageTableOfContents } from "~/components/page-table-of-contents"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion"
import { cn } from "~/lib/utils"

import { useDocsBreadcrumb } from "./docs-breadcrumb"
import { docsCatalog } from "./docs-catalog"
import { getDocumentationPageIcon } from "./docs-navigation-icons"
import { DocsPageActions } from "./docs-page-actions"
import type { DocumentationSectionKey } from "./docs-sections"

// The outline column is fixed at the container's right edge and the article
// centers in the remaining column through its own max-w-3xl mx-auto wrapper,
// so slack spreads around the article instead of pooling beside the outline.
const docsContentGridClassName =
  "mx-auto grid w-full max-w-[80rem] gap-0 lg:grid-cols-[minmax(0,1fr)_15rem]"

const lastModifiedDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
})

const getNavigationLinkStateClassName = (isCurrentPage: boolean) =>
  isCurrentPage
    ? "bg-muted font-medium text-foreground"
    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"

const DocsSidebarContents = ({
  section,
  currentSlug,
}: {
  section: DocumentationSectionKey
  currentSlug?: string
}) => {
  const groups = docsCatalog.getGroups(section)
  const currentGroup = currentSlug
    ? groups.find((group) =>
        group.pages.some((page) => page.slug === currentSlug)
      )
    : undefined

  return (
    <>
      <nav aria-label="Documentation navigation" className="flex-1 space-y-0.5">
        {groups.map((group) => (
          <Accordion
            key={group.group}
            multiple
            className="rounded-none border-0"
            defaultValue={
              !currentSlug || currentGroup === group ? [group.group] : []
            }
          >
            <AccordionItem
              value={group.group}
              className="border-b-0 data-open:bg-transparent"
            >
              <AccordionTrigger className="rounded-lg px-3 py-2.5 text-sm font-medium hover:no-underline">
                {group.group}
              </AccordionTrigger>
              <AccordionContent className="-mx-4 pb-2 [&_a]:no-underline">
                <ul className="flex flex-col gap-0.5">
                  {group.pages.map((page) => {
                    const isCurrentPage = page.slug === currentSlug

                    return (
                      <li key={page.slug}>
                        <Link
                          to={page.url}
                          prefetch="intent"
                          aria-current={isCurrentPage ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                            getNavigationLinkStateClassName(isCurrentPage)
                          )}
                        >
                          <HugeiconsIcon
                            icon={getDocumentationPageIcon(page.slug)}
                            aria-hidden="true"
                            className="size-4 shrink-0"
                            strokeWidth={1.75}
                          />
                          <span className="truncate">{page.navLabel}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ))}
      </nav>

      <nav
        aria-label="Documentation sections"
        className="grid grid-cols-2 gap-1 border-t border-border pt-4"
      >
        {docsCatalog.sections.map((candidate) => {
          const isCurrentSection = candidate.key === section

          return (
            <Link
              key={candidate.key}
              to={candidate.root}
              prefetch="intent"
              aria-current={isCurrentSection ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-center text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                getNavigationLinkStateClassName(isCurrentSection)
              )}
            >
              {candidate.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}

/**
 * Shared documentation shell: the section sidebar sits flush with the left
 * edge, and the content column fills the remaining width without an outer
 * max-width wrapper.
 */
export const DocsShell = ({
  section,
  currentSlug,
  children,
}: {
  section: DocumentationSectionKey
  currentSlug?: string
  children: ReactNode
}) => (
  <div className="w-full lg:flex">
    <aside className="sticky top-16 hidden h-[calc(100svh-4rem)] w-72 shrink-0 flex-col self-start overflow-y-auto border-r border-border px-5 py-7 lg:flex xl:w-80 xl:px-6">
      <DocsSidebarContents section={section} currentSlug={currentSlug} />
    </aside>

    <div className="min-w-0 flex-1">
      <details className="group border-b border-border px-6 py-3 lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          Browse documentation
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            aria-hidden="true"
            strokeWidth={2}
            className="size-4 shrink-0 transition-transform duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)] group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <div className="mt-4 flex max-h-[65svh] flex-col gap-5 overflow-y-auto pb-1">
          <DocsSidebarContents section={section} currentSlug={currentSlug} />
        </div>
      </details>

      {children}
    </div>
  </div>
)

const PageNavigation = ({
  page,
  label,
  direction,
}: {
  page: DocumentationPage
  label: string
  direction: "previous" | "next"
}) => (
  <Link
    to={page.url}
    prefetch="intent"
    className={`group flex min-w-0 flex-col gap-1 rounded-lg border border-border p-4 text-sm transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
      direction === "next" ? "items-end text-right" : "items-start"
    }`}
  >
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
      {direction === "previous" && (
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          aria-hidden="true"
          className="size-4 shrink-0 rotate-180"
        />
      )}
      <span className="truncate">{page.navLabel}</span>
      {direction === "next" && (
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          aria-hidden="true"
          className="size-4 shrink-0"
        />
      )}
    </span>
  </Link>
)

export const DocsDocumentLayout = ({
  context,
  children,
  headings,
  lastModified,
}: {
  context: DocumentationPageContext
  children: ReactNode
  headings: readonly DocumentationHeading[]
  lastModified?: string
}) => {
  const breadcrumb = useDocsBreadcrumb()

  return (
    <DocsShell section={context.section} currentSlug={context.page.slug}>
      <div className="px-6 md:px-8 lg:hidden">
        <MobilePageOutline
          headings={headings}
          targetId="docs-content"
          revealAfterSelector="#docs-page-introduction"
          className="-mb-10"
        />
      </div>

      {/* One grid holds the introduction, the article, and the outline; the
       outline cell spans both rows so "On this page" starts beside the page
       title instead of below the introduction separator. */}
      <div className={docsContentGridClassName}>
        <div className="min-w-0 border-b border-border px-6 pb-10 pt-8 md:px-8 lg:pt-12 xl:px-10">
          <header
            id="docs-page-introduction"
            className="mx-auto flex max-w-3xl flex-col gap-5"
          >
            {breadcrumb && (
              <nav
                aria-label="Breadcrumb"
                className="flex min-w-0 items-center gap-2 text-sm"
              >
                <span className="shrink-0 text-muted-foreground">
                  {breadcrumb.group}
                </span>
                <HugeiconsIcon
                  icon={ChevronRightIcon}
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <span
                  aria-current="page"
                  className="truncate font-medium text-foreground"
                >
                  {breadcrumb.pageLabel}
                </span>
              </nav>
            )}
            <h1 className="text-3xl font-inter-tight font-medium tracking-tight text-balance md:text-4xl">
              {context.page.title}
            </h1>
            <p className="text-base leading-7 text-muted-foreground text-pretty">
              {context.page.description}
            </p>
            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <DocsPageActions page={context.page} />
              {lastModified && (
                <p className="text-sm text-muted-foreground">
                  Last updated{" "}
                  <time dateTime={lastModified}>
                    {lastModifiedDateFormatter.format(
                      new Date(`${lastModified}T00:00:00Z`)
                    )}
                  </time>
                </p>
              )}
            </div>
          </header>
        </div>

        <div className="hidden lg:row-span-2 lg:block">
          <aside className="sticky top-16 h-[calc(100svh-4rem)] overflow-y-auto py-12 pl-2 pr-4">
            <PageTableOfContents headings={headings} targetId="docs-content" />
          </aside>
        </div>

        <article className="min-w-0 px-6 pb-16 pt-10 md:px-8 xl:px-10">
          <div className="mx-auto max-w-3xl">
            <div
              id="docs-content"
              className="typeset typeset-docs docs-content"
            >
              {children}
            </div>

            {(context.previous || context.next) && (
              <nav
                aria-label="Documentation pages"
                className="mt-12 grid grid-cols-2 gap-3 border-t border-border pt-6"
              >
                {context.previous ? (
                  <PageNavigation
                    page={context.previous}
                    label="Previous"
                    direction="previous"
                  />
                ) : (
                  <span />
                )}
                {context.next && (
                  <PageNavigation
                    page={context.next}
                    label="Next"
                    direction="next"
                  />
                )}
              </nav>
            )}
          </div>
        </article>
      </div>
    </DocsShell>
  )
}

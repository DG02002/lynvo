import type { ReactNode } from "react"
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "react-router"

import { DocsDesktopNavigation, DocsMobileNavigation } from "./docs-navigation"
import { DocsPageActions } from "./docs-page-actions"
import { DocsTableOfContents } from "./docs-table-of-contents"
import { cn } from "~/lib/utils"

const lastModifiedDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
})

const DocsPageLink = ({
  page,
  direction,
}: {
  page: DocumentationPage
  direction: "previous" | "next"
}) => (
  <Link
    to={page.url}
    className={cn(
      "group flex min-w-0 items-center gap-3 py-2 text-foreground",
      direction === "next" && "ml-auto text-right"
    )}
  >
    {direction === "previous" && (
      <HugeiconsIcon
        icon={ArrowLeft01Icon}
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1"
      />
    )}
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">
        {direction === "previous" ? "Previous" : "Next"}
      </span>
      <span className="truncate text-sm">{page.navLabel}</span>
    </span>
    {direction === "next" && (
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
      />
    )}
  </Link>
)

export const DocsDocumentLayout = ({
  context,
  children,
}: {
  context: DocumentationPageContext
  children: ReactNode
}) => (
  <div className="mx-auto w-full max-w-[96rem] px-4 py-6 md:px-8 lg:py-0">
    <DocsMobileNavigation context={context} />

    <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,44rem)] lg:justify-center xl:grid-cols-[16rem_minmax(0,44rem)_14rem]">
      <DocsDesktopNavigation context={context} />

      <article className="min-w-0 self-start py-4 lg:py-12">
        <header className="flex flex-col gap-5 border-b pb-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <h1 className="max-w-xl text-3xl font-normal tracking-tight text-balance md:text-4xl">
              {context.page.title}
            </h1>
            <div className="shrink-0">
              <DocsPageActions
                page={context.page}
                previous={context.previous}
                next={context.next}
              />
            </div>
          </div>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground text-pretty">
            {context.page.description}
          </p>
        </header>

        <div className="docs-content flex flex-col gap-14 pt-10">
          {children}
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          Last updated{" "}
          <time dateTime={context.page.lastModified}>
            {lastModifiedDateFormatter.format(
              new Date(`${context.page.lastModified}T00:00:00Z`)
            )}
          </time>
        </p>

        <nav
          aria-label="Adjacent documentation pages"
          className="mt-14 flex items-center"
        >
          {context.previous && (
            <DocsPageLink page={context.previous} direction="previous" />
          )}
          {context.next && (
            <DocsPageLink page={context.next} direction="next" />
          )}
        </nav>
      </article>

      <aside className="sticky top-16 hidden max-h-[calc(100svh-4rem)] self-start overflow-y-auto py-12 [scrollbar-width:none] xl:block">
        <DocsTableOfContents headings={context.page.headings} />
      </aside>
    </div>
  </div>
)

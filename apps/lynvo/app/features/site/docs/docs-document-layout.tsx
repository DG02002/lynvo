import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ReactNode } from "react"
import { Link } from "react-router"

import { MobilePageOutline } from "~/components/mobile-page-outline"
import { PageTableOfContents } from "~/components/page-table-of-contents"

import { DocsPageActions } from "./docs-page-actions"

const lastModifiedDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
})

const DocsSidebarContents = ({
  context,
}: {
  context: DocumentationPageContext
}) => (
  <>
    <nav aria-label="Documentation navigation" className="flex-1 space-y-5">
      {context.groups.map((group) => (
        <details
          key={group.group}
          open={group.pages.some((page) => page.slug === context.page.slug)}
          className="group"
        >
          <summary className="cursor-pointer list-none rounded-md py-1 text-sm font-medium text-foreground marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            {group.group}
          </summary>
          <ul className="mt-1 flex flex-col gap-0.5 border-l border-border pl-3">
            {group.pages.map((page) => {
              const isCurrentPage = page.slug === context.page.slug

              return (
                <li key={page.slug}>
                  <Link
                    to={page.url}
                    prefetch="intent"
                    aria-current={isCurrentPage ? "page" : undefined}
                    className={`block rounded-md px-3 py-2 text-sm leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                      isCurrentPage
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    {page.navLabel}
                  </Link>
                </li>
              )
            })}
          </ul>
        </details>
      ))}
    </nav>

    <nav
      aria-label="Documentation sections"
      className="grid grid-cols-2 gap-1 border-t border-border pt-4"
    >
      <Link
        to="/docs"
        prefetch="intent"
        aria-current={context.section === "user" ? "page" : undefined}
        className={`rounded-md px-3 py-2 text-center text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
          context.section === "user"
            ? "bg-muted font-medium text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        }`}
      >
        Using Lynvo
      </Link>
      <Link
        to="/docs/plugin-server"
        prefetch="intent"
        aria-current={context.section === "developer" ? "page" : undefined}
        className={`rounded-md px-3 py-2 text-center text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
          context.section === "developer"
            ? "bg-muted font-medium text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        }`}
      >
        Developers
      </Link>
    </nav>
  </>
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
}: {
  context: DocumentationPageContext
  children: ReactNode
}) => (
  <div className="w-full px-6 pb-12 pt-6 md:px-8 lg:px-10 lg:py-0 xl:px-14">
    <details className="mb-5 rounded-xl border border-border px-4 py-3 lg:hidden">
      <summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        Browse documentation
      </summary>
      <div className="mt-4 flex max-h-[65svh] flex-col gap-5 overflow-y-auto pb-1">
        <DocsSidebarContents context={context} />
      </div>
    </details>

    <MobilePageOutline
      targetId="docs-content"
      revealAfterSelector="#docs-page-introduction"
      className="-mt-6 lg:hidden"
    />

    <div className="mx-auto grid w-full max-w-[112rem] gap-8 lg:grid-cols-[15rem_minmax(0,1fr)_13rem] xl:grid-cols-[18rem_minmax(0,1fr)_16rem] xl:gap-10">
      <aside className="sticky top-16 hidden h-[calc(100svh-4rem)] self-start border-r border-border py-7 pr-6 lg:flex lg:flex-col">
        <DocsSidebarContents context={context} />
      </aside>

      <article className="min-w-0 self-start py-4 lg:py-12">
        <header
          id="docs-page-introduction"
          className="flex flex-col gap-5 border-b border-border pb-10"
        >
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <span>{context.group}</span>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              aria-hidden="true"
              className="size-3.5 shrink-0"
              strokeWidth={1.5}
            />
            <span aria-current="page" className="text-foreground">
              {context.page.navLabel}
            </span>
          </nav>
          <h1 className="max-w-3xl text-3xl font-normal tracking-tight text-balance md:text-4xl">
            {context.page.title}
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground text-pretty">
            {context.page.description}
          </p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <DocsPageActions page={context.page} />
            <p className="text-sm text-muted-foreground">
              Last updated{" "}
              <time dateTime={context.page.lastModified}>
                {lastModifiedDateFormatter.format(
                  new Date(`${context.page.lastModified}T00:00:00Z`)
                )}
              </time>
            </p>
          </div>
        </header>

        <div
          id="docs-content"
          className="typeset typeset-docs docs-content max-w-5xl pt-10"
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
      </article>

      <aside className="sticky top-16 hidden max-h-[calc(100svh-4rem)] self-start overflow-y-auto py-12 lg:block">
        <PageTableOfContents targetId="docs-content" className="px-0" />
      </aside>
    </div>
  </div>
)

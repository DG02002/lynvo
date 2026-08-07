import type { ReactNode } from "react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
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

export const DocsDocumentLayout = ({
  context,
  children,
}: {
  context: DocumentationPageContext
  children: ReactNode
}) => (
  <div className="w-full px-5 pb-12 pt-6 md:px-8 lg:px-10 lg:py-0 xl:px-14">
    <MobilePageOutline
      targetId="docs-content"
      revealAfterSelector="#docs-page-introduction"
      className="-mt-6 lg:hidden"
    />

    <div className="mx-auto grid w-full max-w-[112rem] gap-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-0 xl:grid-cols-[21rem_minmax(0,1fr)]">
      <aside className="sticky top-16 hidden h-[calc(100svh-4rem)] self-start border-r border-border lg:flex lg:flex-col">
        <nav
          aria-label="Documentation guides"
          className="flex items-center gap-2 py-8 pr-8 text-sm"
        >
          <Link
            to="/docs"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Docs
          </Link>
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground/60"
            strokeWidth={1.5}
          />
          <span>{context.page.navLabel}</span>
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-10 pr-8 [scrollbar-width:none]">
          <PageTableOfContents targetId="docs-content" className="px-0" />
        </div>
      </aside>

      <article className="min-w-0 self-start py-4 lg:py-12 lg:pl-12 lg:pr-4 xl:pl-16 xl:pr-10">
        <header
          id="docs-page-introduction"
          className="flex flex-col gap-5 border-b border-border pb-10 lg:-ml-12 lg:pl-12 xl:-ml-16 xl:pl-16"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <h1 className="max-w-xl text-3xl font-normal tracking-tight text-balance md:text-4xl">
              {context.page.title}
            </h1>
          </div>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground text-pretty">
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
          className="typeset typeset-docs docs-content max-w-6xl pt-12"
        >
          {children}
        </div>
      </article>
    </div>
  </div>
)

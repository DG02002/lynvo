import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "react-router"

import { useViewTransition } from "~/lib/client-profile"

import { docsCatalog } from "./docs-catalog"
import { DocsShell } from "./docs-document-layout"
import { getDocumentationPageIcon } from "./docs-navigation-icons"
import type { DocumentationSectionKey } from "./docs-sections"

export const DocsHome = ({ section }: { section: DocumentationSectionKey }) => {
  const sectionInfo = docsCatalog.getSection(section)
  const groups = docsCatalog.getGroups(section)
  const viewTransition = useViewTransition()

  return (
    <DocsShell section={section}>
      <div className="px-6 pb-16 pt-10 md:px-8 lg:pt-16 xl:px-10">
        <div className="mx-auto max-w-6xl">
          <header className="flex flex-col gap-3">
            <h1 className="text-4xl font-medium tracking-tight text-balance md:text-6xl">
              {sectionInfo.homeTitle}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground text-pretty">
              {sectionInfo.homeDescription}
            </p>
          </header>

          {groups.map((group) => (
            <section key={group.group} className="mt-12 flex flex-col gap-4">
              <h2 className="text-xl font-medium tracking-tight">
                {group.group}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {group.pages.map((page) => (
                  <Link
                    key={page.slug}
                    to={page.url}
                    prefetch="intent"
                    viewTransition={viewTransition}
                    className="group flex min-h-44 flex-col justify-between gap-8 rounded-2xl bg-muted/35 p-6 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.07),0_8px_24px_-16px_rgba(0,0,0,0.2)] transition-[background-color,box-shadow,scale] duration-200 hover:bg-muted/60 hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1),0_18px_40px_-20px_rgba(0,0,0,0.3)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring active:scale-[0.96] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                  >
                    <HugeiconsIcon
                      icon={getDocumentationPageIcon(page.slug)}
                      aria-hidden="true"
                      className="size-7"
                      strokeWidth={1.5}
                    />
                    <span className="flex min-w-0 flex-col gap-2">
                      <span className="text-lg tracking-tight text-balance">
                        {page.navLabel}
                      </span>
                      <span className="text-sm leading-6 text-muted-foreground">
                        {page.description}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </DocsShell>
  )
}

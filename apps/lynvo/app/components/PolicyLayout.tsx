import * as React from "react"
import { MobilePageOutline } from "~/components/mobile-page-outline"
import { PageTableOfContents } from "~/components/page-table-of-contents"

const createPolicySectionId = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

interface PolicyLayoutProps {
  title: string
  updatedAt: string
  children: React.ReactNode
}

export function PolicyLayout({
  title,
  updatedAt,
  children,
}: PolicyLayoutProps) {
  const outlineHeadings = React.Children.toArray(children).flatMap((child) => {
    if (
      !React.isValidElement<{ title?: string }>(child) ||
      child.type !== PolicySection ||
      typeof child.props.title !== "string"
    ) {
      return []
    }

    return [
      {
        id: createPolicySectionId(child.props.title),
        label: child.props.title,
      },
    ]
  })

  return (
    <article className="w-full px-6 py-12 font-normal md:px-8 lg:px-10 xl:px-14">
      <MobilePageOutline
        headings={outlineHeadings}
        targetId="policy-content"
        revealAfterSelector="#policy-content > p:first-child"
        className="-mt-12 xl:hidden"
      />

      <header className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 pt-20 text-center md:pt-0">
        <p className="text-sm">Updated: {updatedAt}</p>
        <div className="space-y-8">
          <h1 className="py-4 text-4xl font-normal tracking-tight text-balance md:py-6 md:text-6xl">
            {title}
          </h1>
        </div>
      </header>

      <div className="mt-10 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,42rem)_minmax(0,1fr)] xl:gap-12 2xl:gap-16">
        <aside className="hidden min-w-0 self-stretch xl:block">
          <PageTableOfContents
            headings={outlineHeadings}
            variant="policy"
            className="sticky top-24 max-h-[calc(100svh-7rem)] overflow-y-auto overscroll-contain pb-12 [scrollbar-width:none]"
          />
        </aside>

        <div
          id="policy-content"
          className="typeset typeset-policy mx-auto w-full max-w-2xl xl:mx-0"
        >
          {children}
        </div>

        <div aria-hidden="true" />
      </div>
    </article>
  )
}

export function PolicySection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 id={createPolicySectionId(title)}>{title}</h2>
      <div>{children}</div>
    </section>
  )
}

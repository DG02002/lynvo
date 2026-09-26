import interTightLatinFontUrl from "@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2?url"
import jetbrainsMonoLatinFontUrl from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url"
import { Suspense } from "react"
import {
  data,
  isRouteErrorResponse,
  redirect,
  useLoaderData,
} from "react-router"

import { docsCatalog } from "./docs-catalog"
import { docsComponents } from "./docs-components"
import { DocsDocumentLayout } from "./docs-document-layout"
import { DocsHome } from "./docs-home"
import {
  getDeveloperDocsRedirectSlug,
  getDocumentationSection,
  type DocumentationSectionKey,
} from "./docs-sections"

export interface DocsRouteParams {
  params: Record<string, string | undefined>
}

export interface DocsLoaderData {
  slug: string | null
  breadcrumb: {
    group: string
    pageLabel: string
  } | null
  metadata: {
    title: string
    description: string
    contentType: DocumentationPage["contentType"]
  } | null
  headings: readonly DocumentationHeading[] | null
  lastModified?: string
}

const DocsContentLoading = ({
  headings,
}: {
  headings: readonly DocumentationHeading[]
}) => (
  <div role="status" aria-label="Loading documentation" className="space-y-8">
    <span className="sr-only">Loading documentation</span>
    <div aria-hidden="true" className="space-y-8">
      {headings.map((heading, index) => (
        <div key={heading.id} className="space-y-4">
          <div
            className={`h-6 animate-pulse rounded bg-muted motion-reduce:animate-none ${heading.level === 3 ? "ml-4 w-2/5" : "w-1/2"}`}
          />
          <div className="h-4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div
            className={`h-4 animate-pulse rounded bg-muted motion-reduce:animate-none ${index % 2 === 0 ? "w-4/5" : "w-3/5"}`}
          />
        </div>
      ))}
    </div>
  </div>
)

const DocsSectionPage = ({ section }: { section: DocumentationSectionKey }) => {
  const loaderData = useLoaderData<DocsLoaderData>()
  const context = loaderData.slug
    ? docsCatalog.resolve(section, loaderData.slug)
    : undefined

  if (!context) {
    return <DocsHome section={section} />
  }
  if (!loaderData.headings) {
    throw new Error(`Documentation headings are missing: ${context.page.slug}`)
  }

  const { Content } = context.page

  return (
    <DocsDocumentLayout
      context={context}
      headings={loaderData.headings}
      lastModified={loaderData.lastModified}
    >
      <Suspense
        fallback={<DocsContentLoading headings={loaderData.headings} />}
      >
        <Content components={docsComponents} />
      </Suspense>
    </DocsDocumentLayout>
  )
}

const DocsSectionNotFound = () => (
  <section className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
    <h1 className="text-4xl font-inter-tight font-medium tracking-tight text-balance sm:text-6xl">
      This documentation page can’t be found.
    </h1>
  </section>
)

export const createDocsSectionRoute = (section: DocumentationSectionKey) => ({
  // Docs headings render in Inter Tight and code blocks in JetBrains Mono;
  // preloading the latin subsets keeps first paint from swapping fonts.
  links: () => [
    {
      rel: "preload",
      href: interTightLatinFontUrl,
      as: "font",
      type: "font/woff2",
      crossOrigin: "anonymous",
    },
    {
      rel: "preload",
      href: jetbrainsMonoLatinFontUrl,
      as: "font",
      type: "font/woff2",
      crossOrigin: "anonymous",
    },
  ],

  loader: ({ params }: DocsRouteParams) => {
    const requestedSlug = params["*"]

    if (!requestedSlug) {
      return {
        slug: null,
        breadcrumb: null,
        metadata: null,
        headings: null,
      }
    }

    const redirectedSlug =
      section === "user"
        ? getDeveloperDocsRedirectSlug(requestedSlug)
        : undefined
    if (redirectedSlug !== undefined) {
      return redirect(
        redirectedSlug ? `/developer/${redirectedSlug}` : "/developer"
      )
    }

    const context = docsCatalog.resolve(section, requestedSlug)
    if (!context) {
      throw data(null, { status: 404 })
    }

    return {
      slug: requestedSlug,
      breadcrumb: {
        group: context.group,
        pageLabel: context.page.navLabel,
      },
      metadata: {
        title: context.page.title,
        description: context.page.description,
        contentType: context.page.contentType,
      },
      headings: null,
    }
  },

  meta: ({ data: loaderData }: { data: DocsLoaderData | undefined }) => {
    const sectionInfo = getDocumentationSection(section)
    if (!loaderData?.slug) {
      return [
        { title: `${sectionInfo.label} | Lynvo` },
        { name: "description", content: sectionInfo.homeDescription },
      ]
    }

    if (!loaderData.metadata) {
      return [
        { title: "Page not found | Lynvo" },
        { name: "robots", content: "noindex" },
      ]
    }

    return [
      { title: `${loaderData.metadata.title} | Lynvo` },
      { name: "description", content: loaderData.metadata.description },
      { name: "contentType", content: loaderData.metadata.contentType },
    ]
  },

  Component: () => <DocsSectionPage section={section} />,

  ErrorBoundary: ({ error }: { error: unknown }) => {
    const isNotFound = isRouteErrorResponse(error) && error.status === 404

    if (!isNotFound) {
      throw error
    }

    return <DocsSectionNotFound />
  },
})

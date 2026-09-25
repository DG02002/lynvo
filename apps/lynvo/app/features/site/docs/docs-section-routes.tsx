import { Suspense } from "react"
import { data, isRouteErrorResponse, redirect, useParams } from "react-router"

import { docsCatalog } from "./docs-catalog"
import { docsComponents } from "./docs-components"
import { DocsDocumentLayout } from "./docs-document-layout"
import { DocsHome } from "./docs-home"

type DocumentationSectionKey = DocumentationPageContext["section"]

export interface DocsRouteParams {
  params: Record<string, string | undefined>
}

export interface DocsLoaderData {
  slug: string | null
}

const legacyPluginServerSlug = "plugin-server"
const legacyPluginServerPrefix = "plugin-server/"

const getRedirectedDeveloperSlug = (slug: string): string | undefined => {
  if (slug === legacyPluginServerSlug) {
    return ""
  }

  if (slug.startsWith(legacyPluginServerPrefix)) {
    return slug.slice(legacyPluginServerPrefix.length)
  }

  return undefined
}

const DocsSectionPage = ({ section }: { section: DocumentationSectionKey }) => {
  const params = useParams()
  const context = params["*"]
    ? docsCatalog.resolve(section, params["*"])
    : undefined

  if (!context) {
    return <DocsHome section={section} />
  }

  const { Content } = context.page

  return (
    <DocsDocumentLayout context={context}>
      <Suspense fallback={null}>
        <Content components={docsComponents} />
      </Suspense>
    </DocsDocumentLayout>
  )
}

const DocsSectionNotFound = () => (
  <section className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
    <h1 className="text-4xl font-normal tracking-tight text-balance sm:text-6xl">
      This documentation page can’t be found.
    </h1>
  </section>
)

export const createDocsSectionRoute = (section: DocumentationSectionKey) => ({
  loader: ({ params }: DocsRouteParams) => {
    const requestedSlug = params["*"]

    if (!requestedSlug) {
      return { slug: null }
    }

    const redirectedSlug =
      section === "user" ? getRedirectedDeveloperSlug(requestedSlug) : undefined
    if (redirectedSlug !== undefined) {
      return redirect(
        redirectedSlug ? `/developer/${redirectedSlug}` : "/developer"
      )
    }

    if (!docsCatalog.resolve(section, requestedSlug)) {
      throw data(null, { status: 404 })
    }

    return { slug: requestedSlug }
  },

  meta: ({ data: loaderData }: { data: DocsLoaderData | undefined }) => {
    if (!loaderData?.slug) {
      const sectionInfo = docsCatalog.getSection(section)

      return [
        { title: `${sectionInfo.label} | Lynvo` },
        { name: "description", content: sectionInfo.homeDescription },
      ]
    }

    const context = docsCatalog.resolve(section, loaderData.slug)
    if (!context) {
      return [
        { title: "Page not found | Lynvo" },
        { name: "robots", content: "noindex" },
      ]
    }

    return [
      { title: `${context.page.title} | Lynvo` },
      { name: "description", content: context.page.description },
      { name: "contentType", content: context.page.contentType },
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

export const createDocsMarkdownLoader =
  (section: DocumentationSectionKey) =>
  ({ params }: DocsRouteParams) => {
    const slug = params["*"]

    if (slug && section === "user") {
      const redirectedSlug = getRedirectedDeveloperSlug(slug)
      if (redirectedSlug !== undefined) {
        return redirect(
          redirectedSlug
            ? `/developer/markdown/${redirectedSlug}`
            : "/developer/markdown/what-is-a-plugin-server"
        )
      }
    }

    const markdown = slug ? docsCatalog.getMarkdown(section, slug) : undefined

    if (!markdown || !slug) {
      throw data(null, { status: 404 })
    }

    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `inline; filename="${slug.replaceAll("/", "-")}.md"`,
      },
    })
  }

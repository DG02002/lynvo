import { Suspense } from "react"
import { data, isRouteErrorResponse, useParams } from "react-router"

import type { Route } from "./+types/_site.docs"
import { docsComponents } from "~/features/site/docs/docs-components"
import { DocsDocumentLayout } from "~/features/site/docs/docs-document-layout"
import { DocsLanding } from "~/features/site/docs/docs-landing"
import { docsCatalog } from "~/features/site/docs/docs-catalog"

export const loader = ({ params }: Route.LoaderArgs) => {
  const requestedSlug = params["*"]

  if (!requestedSlug) {
    return { slug: null }
  }

  if (!docsCatalog.resolve(requestedSlug)) {
    throw data(null, { status: 404 })
  }

  return { slug: requestedSlug }
}

export const meta = ({ loaderData }: Route.MetaArgs) => {
  if (!loaderData?.slug) {
    return [
      { title: "Documentation | Lynvo" },
      {
        name: "description",
        content: "Create a Custom Plugin Server or set up Lynvo on Android TV.",
      },
      { name: "contentType", content: "Landing" },
    ]
  }

  const context = docsCatalog.resolve(loaderData.slug)
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
}

export default function Docs(_: Route.ComponentProps) {
  const params = useParams()
  const context = params["*"] ? docsCatalog.resolve(params["*"]) : undefined

  if (!context) {
    return <DocsLanding />
  }

  const Content = context.page.Content

  return (
    <DocsDocumentLayout context={context}>
      <Suspense fallback={null}>
        <Content components={docsComponents} />
      </Suspense>
    </DocsDocumentLayout>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const isNotFound = isRouteErrorResponse(error) && error.status === 404

  if (!isNotFound) {
    throw error
  }

  return (
    <section className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-4xl font-normal tracking-tight text-balance sm:text-6xl">
        This documentation page can’t be found.
      </h1>
    </section>
  )
}

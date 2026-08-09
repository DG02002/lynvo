import { lazy } from "react"
import { render } from "@testing-library/react"
import { MemoryRouter } from "react-router"

import { DocsDocumentLayout } from "~/features/site/docs/docs-document-layout"

const Content = lazy(async () => ({ default: () => null }))

const context: DocumentationPageContext = {
  groups: [],
  page: {
    slug: "android-tv",
    url: "/docs/android-tv",
    markdownUrl: "/docs/markdown/android-tv",
    navLabel: "Android TV setup",
    title: "Android TV setup",
    description: "Set up Lynvo on Android TV.",
    contentType: "Tutorial",
    lastModified: "2026-08-07",
    headings: [],
    rawContent: "",
    Content,
  },
}

it("uses the standard mobile page gutter", () => {
  const { container } = render(
    <MemoryRouter>
      <DocsDocumentLayout context={context}>Documentation</DocsDocumentLayout>
    </MemoryRouter>
  )

  expect(container.firstElementChild).toHaveClass("px-6")
})

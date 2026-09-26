import { Result, Schema } from "effect"
import { data, redirect } from "react-router"

import { docsCatalog } from "./docs-catalog"
import { getDocumentationHeadings } from "./docs-heading"
import { getDocumentationImageExtension } from "./docs-image-assets"
import { cleanDocumentationMarkdown } from "./docs-markdown"
import type { DocsLoaderData, DocsRouteParams } from "./docs-section-routes"
import {
  getDeveloperDocsRedirectSlug,
  getDocumentationContentPath,
  type DocumentationSectionKey,
} from "./docs-sections"

const rawContentModules = import.meta.glob<unknown>("./**/*.mdx", {
  eager: true,
  query: "?docs-raw",
})
const lastModifiedModules = import.meta.glob<string>("./**/*.mdx", {
  eager: true,
  import: "default",
  query: "?docs-last-modified",
})
const defaultContentModuleSchema = Schema.Struct({ default: Schema.Unknown })
const getDocumentationPageKey = (
  section: DocumentationSectionKey,
  slug: string
) => `${section}/${slug}`

const getRawContent = (path: string) => {
  let contentModule = rawContentModules[path]

  while (true) {
    const module = Schema.decodeUnknownResult(defaultContentModuleSchema)(
      contentModule
    )
    if (Result.isFailure(module)) {
      break
    }
    contentModule = module.success.default
  }

  const content = Schema.decodeUnknownResult(Schema.String)(contentModule)
  if (Result.isFailure(content)) {
    const contentKind = Object.prototype.toString.call(contentModule)
    throw new Error(
      `Documentation source could not be read: ${path} [${contentKind}]`
    )
  }

  return content.success
}

interface DocumentationPageSource {
  sourcePath: string
  content: string
  headings: readonly DocumentationHeading[]
}

const resolveLinkTarget = (destinationPath: string) =>
  docsCatalog.sections.find(
    (section) =>
      destinationPath === section.root ||
      destinationPath.startsWith(`${section.root}/`)
  )

const getDocumentationPageSource = (
  section: DocumentationSectionKey,
  page: DocumentationPage
): DocumentationPageSource => {
  const sourcePath = getDocumentationContentPath(section, page.slug)
  const content = getRawContent(sourcePath)
  const headings = getDocumentationHeadings(content)
  const headingIds = new Set<string>()

  for (const heading of headings) {
    if (headingIds.has(heading.id)) {
      throw new Error(
        `Duplicate documentation heading "${heading.id}": ${sourcePath}`
      )
    }
    headingIds.add(heading.id)
  }

  for (const [, name] of content.matchAll(
    /<DocsScreenshot\s+name="([^"]+)"/g
  )) {
    if (!getDocumentationImageExtension(name)) {
      throw new Error(
        `Documentation screenshot asset is missing: ${name} in ${sourcePath}`
      )
    }
  }

  return { sourcePath, content, headings }
}

const validateDocumentationLink = (
  destination: string,
  source: DocumentationPageSource,
  headingsByPage: ReadonlyMap<string, readonly DocumentationHeading[]>
) => {
  if (
    !destination.startsWith("/docs") &&
    !destination.startsWith("/developer") &&
    !destination.startsWith("#")
  ) {
    return
  }

  const [destinationPath, destinationHeading] = destination.split("#")
  const isSectionHome = docsCatalog.sections.some(
    (candidate) => destinationPath === candidate.root
  )
  const isHeadingLink = destinationPath.length === 0
  const targetSection = resolveLinkTarget(destinationPath)
  const destinationSlug = destinationPath.split("/").at(-1)
  let targetHeadings: readonly DocumentationHeading[] | undefined

  if (!isSectionHome) {
    if (isHeadingLink) {
      targetHeadings = source.headings
    } else if (targetSection && destinationSlug) {
      const targetPage = docsCatalog.resolve(
        targetSection.key,
        destinationSlug
      )?.page
      if (targetPage) {
        targetHeadings = headingsByPage.get(
          getDocumentationPageKey(targetSection.key, targetPage.slug)
        )
      }
    }
  }

  if (!isSectionHome && !targetHeadings) {
    throw new Error(
      `Broken documentation link "${destination}" in ${source.sourcePath}`
    )
  }

  if (
    destinationHeading &&
    targetHeadings &&
    !targetHeadings.some((heading) => heading.id === destinationHeading)
  ) {
    throw new Error(
      `Broken documentation heading link "${destination}" in ${source.sourcePath}`
    )
  }
}

const validateDocumentationSources = () => {
  const headingsByPage = new Map<string, readonly DocumentationHeading[]>()
  const pageSources: DocumentationPageSource[] = []

  for (const section of docsCatalog.sections) {
    const pages = docsCatalog
      .getGroups(section.key)
      .flatMap((group) => group.pages)

    for (const page of pages) {
      const source = getDocumentationPageSource(section.key, page)
      headingsByPage.set(
        getDocumentationPageKey(section.key, page.slug),
        source.headings
      )
      pageSources.push(source)
    }
  }

  for (const source of pageSources) {
    for (const [, destination] of source.content.matchAll(
      /\[[^\]]+\]\(([^)]+)\)/g
    )) {
      validateDocumentationLink(destination, source, headingsByPage)
    }
  }

  return headingsByPage
}

const documentationHeadingsByPage = validateDocumentationSources()

const getDocumentationLastModified = (
  section: DocumentationSectionKey,
  slug: string
) => {
  const path = getDocumentationContentPath(section, slug)
  const lastModified = lastModifiedModules[path]
  if (!lastModified) {
    throw new Error(`Documentation last-modified date is missing: ${path}`)
  }
  return lastModified
}

const getDocumentationMarkdown = (
  section: DocumentationSectionKey,
  slug: string
) => {
  const page = docsCatalog.resolve(section, slug)?.page
  if (!page) {
    return undefined
  }

  return cleanDocumentationMarkdown(
    getRawContent(getDocumentationContentPath(section, slug)),
    getDocumentationImageExtension
  )
}

type DocumentationPageLoader = (
  parameters: DocsRouteParams
) => DocsLoaderData | Response | Promise<DocsLoaderData | Response>

export const withDocumentationLastModified = async (
  section: DocumentationSectionKey,
  loader: DocumentationPageLoader,
  parameters: DocsRouteParams
) => {
  const loaderData = await loader(parameters)
  if (loaderData instanceof Response || !loaderData.slug) {
    return loaderData
  }

  const headings = documentationHeadingsByPage.get(
    getDocumentationPageKey(section, loaderData.slug)
  )
  if (!headings) {
    throw new Error(
      `Documentation headings are missing: ${section}/${loaderData.slug}`
    )
  }

  return {
    ...loaderData,
    lastModified: getDocumentationLastModified(section, loaderData.slug),
    headings,
  }
}

export const createDocsMarkdownLoader =
  (section: DocumentationSectionKey) =>
  ({ params }: DocsRouteParams) => {
    const slug = params["*"]

    if (slug && section === "user") {
      const redirectedSlug = getDeveloperDocsRedirectSlug(slug)
      if (redirectedSlug !== undefined) {
        return redirect(
          redirectedSlug
            ? `/developer/markdown/${redirectedSlug}`
            : "/developer/markdown/what-is-a-plugin-server"
        )
      }
    }

    const markdown = slug ? getDocumentationMarkdown(section, slug) : undefined

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

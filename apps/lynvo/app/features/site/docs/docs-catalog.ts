import { lazy } from "react"

import extractorMeta from "./extractor/meta.json"
import rootMeta from "./meta.json"

const contentModules = import.meta.glob<DocumentationMdxModule>("./**/*.mdx")
const contentFrontmatter = import.meta.glob<DocumentationFrontmatter>(
  "./**/*.mdx",
  {
    eager: true,
    import: "frontmatter",
  }
)
const rawContentModules = import.meta.glob<unknown>("./**/*.mdx", {
  eager: true,
  query: "?docs-raw",
})
const lastModifiedModules = import.meta.glob<string>("./**/*.mdx", {
  eager: true,
  import: "default",
  query: "?docs-last-modified",
})

const createHeadingId = (heading: string) =>
  heading
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

const getRawContent = (path: string) => {
  let contentModule = rawContentModules[path]

  while (
    typeof contentModule === "object" &&
    contentModule !== null &&
    "default" in contentModule
  ) {
    contentModule = contentModule.default
  }

  if (typeof contentModule !== "string") {
    const contentKind =
      typeof contentModule === "object" && contentModule !== null
        ? `${contentModule.constructor.name}(${Object.keys(contentModule).join(",")})`
        : typeof contentModule
    throw new Error(
      `Documentation source could not be read: ${path} [${contentKind}]`
    )
  }

  return contentModule
}

const getContentFileName = (path: string) =>
  path.slice(path.lastIndexOf("/") + 1, -".mdx".length)

const getContentSlug = (path: string) => {
  const relativePath = path.slice("./".length, -".mdx".length)
  return relativePath === "extractor/extractor" ? "extractor" : relativePath
}

const getHeadings = (content: string): readonly DocumentationHeading[] => {
  const headings: DocumentationHeading[] = []

  for (const line of content.split("\n")) {
    const match = /^(##|###) (.+)$/.exec(line)
    if (!match) {
      continue
    }

    const label = match[2].trim()
    headings.push({
      id: createHeadingId(label),
      label,
      level: match[1] === "###" ? 3 : undefined,
    })
  }

  return headings
}

const validateFrontmatter = (
  path: string,
  frontmatter: DocumentationFrontmatter | undefined
) => {
  if (
    !frontmatter?.title ||
    !frontmatter.description ||
    !frontmatter.navLabel ||
    !frontmatter.contentType
  ) {
    throw new Error(`Documentation frontmatter is incomplete: ${path}`)
  }
}

const pagesByFileName = new Map<string, DocumentationPage>()
const pagesBySlug = new Map<string, DocumentationPage>()
const sourcePathBySlug = new Map<string, string>()

for (const [path, loadContent] of Object.entries(contentModules)) {
  const frontmatter = contentFrontmatter[path]
  const content = getRawContent(path)
  validateFrontmatter(path, frontmatter)

  const slug = getContentSlug(path)
  const headings = getHeadings(content)
  const headingIds = new Set<string>()

  for (const heading of headings) {
    if (headingIds.has(heading.id)) {
      throw new Error(
        `Duplicate documentation heading "${heading.id}": ${path}`
      )
    }
    headingIds.add(heading.id)
  }

  if (pagesBySlug.has(slug)) {
    throw new Error(`Duplicate documentation slug: ${slug}`)
  }

  const page: DocumentationPage = {
    slug,
    url: `/docs/${slug}`,
    markdownUrl: `/docs/markdown/${slug}`,
    navLabel: frontmatter.navLabel,
    title: frontmatter.title,
    description: frontmatter.description,
    contentType: frontmatter.contentType,
    lastModified: lastModifiedModules[path],
    headings,
    rawContent: content,
    Content: lazy(loadContent),
  }

  pagesBySlug.set(slug, page)
  pagesByFileName.set(getContentFileName(path), page)
  sourcePathBySlug.set(slug, path)
}

const createGroups = (
  groups: readonly DocumentationMetaGroup[]
): readonly DocumentationChapterGroup[] =>
  groups.map((group) => ({
    group: group.title,
    pages: group.pages.map((pageName) => {
      const page = pagesByFileName.get(pageName)
      if (!page) {
        throw new Error(
          `Documentation navigation references a missing page: ${pageName}`
        )
      }
      return page
    }),
  }))

const rootGroups = createGroups(rootMeta.groups)
const extractorGroups = createGroups(extractorMeta.groups)
const orderedPages = [
  ...rootGroups[0].pages,
  ...extractorGroups.flatMap((group) => group.pages),
]

if (orderedPages.length !== pagesBySlug.size) {
  throw new Error("Every documentation page must appear once in navigation")
}

const getGroups = (
  page: DocumentationPage
): readonly DocumentationChapterGroup[] =>
  page.slug === "android-tv" ? [rootGroups[0]] : extractorGroups

const getContext = (slug: string): DocumentationPageContext | undefined => {
  const page = pagesBySlug.get(slug)
  if (!page) {
    return
  }

  const pageIndex = orderedPages.indexOf(page)

  return {
    page,
    groups: getGroups(page),
    previous: pageIndex > 0 ? orderedPages[pageIndex - 1] : undefined,
    next:
      pageIndex < orderedPages.length - 1
        ? orderedPages[pageIndex + 1]
        : undefined,
  }
}

const legacySlugs = new Set(
  extractorGroups
    .flatMap((group) => group.pages)
    .filter((page) => page.slug !== "extractor")
    .map((page) => page.slug.slice("extractor/".length))
)

for (const [sourceSlug, sourcePath] of sourcePathBySlug) {
  const content = getRawContent(sourcePath)
  const markdownLinks = content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)

  for (const link of markdownLinks) {
    const destination = link[1]
    if (!destination.startsWith("/docs") && !destination.startsWith("#")) {
      continue
    }

    const [destinationPath, destinationHeading] = destination.split("#")
    const destinationSlug = destinationPath.startsWith("/docs/")
      ? destinationPath.slice("/docs/".length)
      : sourceSlug
    const targetPage =
      destinationPath === "/docs"
        ? undefined
        : (pagesBySlug.get(destinationSlug) ??
          (legacySlugs.has(destinationSlug)
            ? pagesBySlug.get(`extractor/${destinationSlug}`)
            : undefined))

    if (destinationPath !== "/docs" && !targetPage) {
      throw new Error(
        `Broken documentation link "${destination}" in ${sourcePath}`
      )
    }

    if (
      destinationHeading &&
      targetPage &&
      !targetPage.headings.some((heading) => heading.id === destinationHeading)
    ) {
      throw new Error(
        `Broken documentation heading link "${destination}" in ${sourcePath}`
      )
    }
  }
}

export const docsCatalog = {
  resolve: getContext,
  getLegacyRedirect: (slug: string) =>
    legacySlugs.has(slug) ? `/docs/extractor/${slug}` : undefined,
  getMarkdown: (slug: string) => pagesBySlug.get(slug)?.rawContent,
}

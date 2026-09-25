import { Result, Schema } from "effect"
import { lazy } from "react"

import { createHeadingId } from "./docs-heading"
import { getDocumentationImageExtension } from "./docs-image-assets"
import { cleanDocumentationMarkdown } from "./docs-markdown"
import {
  documentationSections,
  getDocumentationPageUrl,
  getDocumentationSection,
  getDocumentationSectionKeyForPath,
  getDocumentationSlug,
  type DocumentationSection,
} from "./docs-sections"
import rootMeta from "./meta.json"
import pluginServerMeta from "./plugin-server/meta.json"

type DocumentationSectionKey = DocumentationPageContext["section"]

const getContentPathKey = (path: string) =>
  path.slice("./".length, -".mdx".length)

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
const defaultContentModuleSchema = Schema.Struct({ default: Schema.Unknown })

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

interface DocumentationSectionState {
  readonly section: DocumentationSection
  readonly pagesBySlug: Map<string, DocumentationPage>
  readonly pagesByContentPath: Map<string, DocumentationPage>
  readonly sourcePathBySlug: Map<string, string>
  groups: readonly DocumentationChapterGroup[]
  orderedPages: DocumentationPage[]
  readonly groupBySlug: Map<string, string>
}

const sectionStates = new Map<
  DocumentationSectionKey,
  DocumentationSectionState
>(
  documentationSections.map((section) => [
    section.key,
    {
      section,
      pagesBySlug: new Map(),
      pagesByContentPath: new Map(),
      sourcePathBySlug: new Map(),
      orderedPages: [],
      groups: [],
      groupBySlug: new Map(),
    },
  ])
)

for (const [path, loadContent] of Object.entries(contentModules)) {
  const frontmatter = contentFrontmatter[path]
  const content = getRawContent(path)
  validateFrontmatter(path, frontmatter)

  const sectionKey = getDocumentationSectionKeyForPath(path)
  const state = sectionStates.get(sectionKey)
  if (!state) {
    throw new Error(`Documentation section is missing: ${sectionKey}`)
  }

  const slug = getDocumentationSlug(path)
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

  if (state.pagesBySlug.has(slug)) {
    throw new Error(`Duplicate documentation slug: ${slug}`)
  }

  const page: DocumentationPage = {
    slug,
    url: getDocumentationPageUrl(sectionKey, slug),
    markdownUrl: `${state.section.root}/markdown/${slug}`,
    navLabel: frontmatter.navLabel,
    title: frontmatter.title,
    description: frontmatter.description,
    contentType: frontmatter.contentType,
    lastModified: lastModifiedModules[path],
    headings,
    rawContent: content,
    Content: lazy(loadContent),
  }

  state.pagesBySlug.set(slug, page)
  state.pagesByContentPath.set(getContentPathKey(path), page)
  state.sourcePathBySlug.set(slug, path)
}

const createGroups = (
  state: DocumentationSectionState,
  groups: readonly DocumentationMetaGroup[]
) => {
  state.groups = groups.map((group) => ({
    group: group.title,
    pages: group.pages.map((contentPathKey) => {
      const page = state.pagesByContentPath.get(contentPathKey)
      if (!page) {
        throw new Error(
          `Documentation navigation references a missing page: ${contentPathKey}`
        )
      }
      return page
    }),
  }))
  state.orderedPages = state.groups.flatMap((group) => group.pages)

  for (const group of state.groups) {
    for (const page of group.pages) {
      if (state.groupBySlug.has(page.slug)) {
        throw new Error(
          `Documentation page appears more than once in navigation: ${page.slug}`
        )
      }
      state.groupBySlug.set(page.slug, group.group)
    }
  }

  const navigatedSlugs = new Set(state.groupBySlug.keys())
  for (const slug of state.pagesBySlug.keys()) {
    if (!navigatedSlugs.has(slug)) {
      throw new Error(
        `Every documentation page must appear exactly once in navigation: ${slug}`
      )
    }
  }
}

createGroups(sectionStates.get("user")!, rootMeta.groups)
createGroups(sectionStates.get("developer")!, pluginServerMeta.groups)

const resolveSection = (key: DocumentationSectionKey) => {
  const state = sectionStates.get(key)
  if (!state) {
    throw new Error(`Documentation section is missing: ${key}`)
  }
  return state
}

const resolveLinkTarget = (
  destinationPath: string
): DocumentationSectionState | undefined => {
  const section = documentationSections.find(
    (item) =>
      destinationPath === item.root ||
      destinationPath.startsWith(`${item.root}/`)
  )

  return section ? resolveSection(section.key) : undefined
}

for (const state of sectionStates.values()) {
  for (const [sourceSlug, sourcePath] of state.sourcePathBySlug) {
    const content = getRawContent(sourcePath)
    const markdownLinks = content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)

    for (const link of markdownLinks) {
      const [, destination] = link
      if (
        !destination.startsWith("/docs") &&
        !destination.startsWith("/developer") &&
        !destination.startsWith("#")
      ) {
        continue
      }

      const [destinationPath, destinationHeading] = destination.split("#")
      const isSectionHome =
        destinationPath === "/docs" || destinationPath === "/developer"
      const isHeadingLink = destinationPath.length === 0
      const targetSection = resolveLinkTarget(destinationPath)
      const destinationSlug = destinationPath.split("/").at(-1)

      let targetPage: DocumentationPage | undefined
      if (!isSectionHome) {
        if (isHeadingLink) {
          targetPage = state.pagesBySlug.get(sourceSlug)
        } else {
          targetPage = targetSection?.pagesBySlug.get(destinationSlug ?? "")
        }
      }

      if (!isSectionHome && !targetPage) {
        throw new Error(
          `Broken documentation link "${destination}" in ${sourcePath}`
        )
      }

      if (
        destinationHeading &&
        targetPage &&
        !targetPage.headings.some(
          (heading) => heading.id === destinationHeading
        )
      ) {
        throw new Error(
          `Broken documentation heading link "${destination}" in ${sourcePath}`
        )
      }
    }
  }
}

export const docsCatalog = {
  sections: documentationSections,
  getSection: getDocumentationSection,
  getGroups: (key: DocumentationSectionKey) => resolveSection(key).groups,
  resolve: (
    key: DocumentationSectionKey,
    slug: string
  ): DocumentationPageContext | undefined => {
    const state = resolveSection(key)
    const page = state.pagesBySlug.get(slug)
    if (!page) {
      return undefined
    }

    const group = state.groupBySlug.get(page.slug)
    if (!group) {
      throw new Error(
        `Documentation page is missing from navigation: ${page.slug}`
      )
    }

    const pageIndex = state.orderedPages.indexOf(page)

    return {
      page,
      groups: state.groups,
      group,
      section: key,
      previous: pageIndex > 0 ? state.orderedPages[pageIndex - 1] : undefined,
      next:
        pageIndex < state.orderedPages.length - 1
          ? state.orderedPages[pageIndex + 1]
          : undefined,
    }
  },
  getMarkdown: (key: DocumentationSectionKey, slug: string) => {
    const page = resolveSection(key).pagesBySlug.get(slug)
    if (!page) {
      return undefined
    }

    return cleanDocumentationMarkdown(
      page.rawContent,
      getDocumentationImageExtension
    )
  },
}

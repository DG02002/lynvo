import { lazy } from "react"

import { assertDocumentationPageIcons } from "./docs-navigation-icons"
import {
  documentationSections,
  getDocumentationContentPathKey,
  getDocumentationPageUrl,
  getDocumentationSection,
  getDocumentationSectionKeyForPath,
  getDocumentationSlug,
  type DocumentationSection,
  type DocumentationSectionKey,
} from "./docs-sections"
import rootMeta from "./meta.json"
import pluginServerMeta from "./plugin-server/meta.json"

const contentModules = import.meta.glob<DocumentationMdxModule>("./**/*.mdx")
const contentFrontmatter = import.meta.glob<DocumentationFrontmatter>(
  "./**/*.mdx",
  {
    eager: true,
    import: "default",
    query: "?docs-frontmatter",
  }
)
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
      orderedPages: [],
      groups: [],
      groupBySlug: new Map(),
    },
  ])
)

const resolveSection = (key: DocumentationSectionKey) => {
  const state = sectionStates.get(key)
  if (!state) {
    throw new Error(`Documentation section is missing: ${key}`)
  }
  return state
}

for (const [path, loadContent] of Object.entries(contentModules)) {
  const frontmatter = contentFrontmatter[path]
  validateFrontmatter(path, frontmatter)

  const sectionKey = getDocumentationSectionKeyForPath(path)
  const state = sectionStates.get(sectionKey)
  if (!state) {
    throw new Error(`Documentation section is missing: ${sectionKey}`)
  }

  const slug = getDocumentationSlug(path)

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
    Content: lazy(loadContent),
  }

  state.pagesBySlug.set(slug, page)
  state.pagesByContentPath.set(getDocumentationContentPathKey(path), page)
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

createGroups(resolveSection("user"), rootMeta.groups)
createGroups(resolveSection("developer"), pluginServerMeta.groups)

const pageSlugs = new Set(
  [...sectionStates.values()].flatMap((state) =>
    Array.from(state.pagesBySlug.keys())
  )
)
assertDocumentationPageIcons(Array.from(pageSlugs))

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
}

import { Result, Schema } from "effect"
import { lazy } from "react"

import { createHeadingId } from "./docs-heading"
import { getDocumentationImageExtension } from "./docs-image-assets"
import {
  assembleDocumentationMarkdown,
  cleanDocumentationMarkdown,
  extractDocumentationSection,
} from "./docs-markdown"
import rootMeta from "./meta.json"
import pluginServerMeta from "./plugin-server/meta.json"

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

const getContentPathKey = (path: string) =>
  path.slice("./".length, -".mdx".length)

const getContentSlug = (path: string) => {
  const relativePath = path.slice("./".length, -".mdx".length)
  return relativePath === "plugin-server/plugin-server"
    ? "plugin-server"
    : relativePath
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

const pagesByContentPath = new Map<string, DocumentationPage>()
const pagesBySlug = new Map<string, DocumentationPage>()
const sourcePathBySlug = new Map<string, string>()

const getPageByContentPath = (contentPathKey: string) => {
  const page = pagesByContentPath.get(contentPathKey)
  if (!page) {
    throw new Error(`Documentation page is missing: ${contentPathKey}`)
  }
  return page
}

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
  pagesByContentPath.set(getContentPathKey(path), page)
  sourcePathBySlug.set(slug, path)
}

const createGroups = (
  groups: readonly DocumentationMetaGroup[]
): readonly DocumentationChapterGroup[] =>
  groups.map((group) => ({
    group: group.title,
    pages: group.pages.map((contentPathKey) => {
      const page = pagesByContentPath.get(contentPathKey)
      if (!page) {
        throw new Error(
          `Documentation navigation references a missing page: ${contentPathKey}`
        )
      }
      return page
    }),
  }))

const rootGroups = createGroups(rootMeta.groups)
const pluginServerGroups = createGroups(pluginServerMeta.groups)
const orderedPages = [
  ...rootGroups.flatMap((group) => group.pages),
  ...pluginServerGroups.flatMap((group) => group.pages),
]
const navigationContextBySlug = new Map<
  string,
  { group: string; section: "user" | "developer" }
>()

for (const [groups, section] of [
  [rootGroups, "user"],
  [pluginServerGroups, "developer"],
] as const) {
  for (const group of groups) {
    for (const page of group.pages) {
      if (navigationContextBySlug.has(page.slug)) {
        throw new Error(
          `Documentation page appears more than once in navigation: ${page.slug}`
        )
      }
      navigationContextBySlug.set(page.slug, { group: group.group, section })
    }
  }
}

if (orderedPages.length !== pagesBySlug.size) {
  throw new Error(
    "Every documentation page must appear exactly once in navigation"
  )
}

const getGroups = (
  page: DocumentationPage
): readonly DocumentationChapterGroup[] =>
  navigationContextBySlug.get(page.slug)?.section === "developer"
    ? pluginServerGroups
    : rootGroups

const getContext = (slug: string): DocumentationPageContext | undefined => {
  const page = pagesBySlug.get(slug)
  if (!page) {
    return undefined
  }

  const pageIndex = orderedPages.indexOf(page)
  const navigationContext = navigationContextBySlug.get(page.slug)

  if (!navigationContext) {
    throw new Error(
      `Documentation page is missing from navigation: ${page.slug}`
    )
  }

  return {
    page,
    groups: getGroups(page),
    group: navigationContext.group,
    section: navigationContext.section,
    previous: pageIndex > 0 ? orderedPages[pageIndex - 1] : undefined,
    next:
      pageIndex < orderedPages.length - 1
        ? orderedPages[pageIndex + 1]
        : undefined,
  }
}

for (const [sourceSlug, sourcePath] of sourcePathBySlug) {
  const content = getRawContent(sourcePath)
  const markdownLinks = content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)

  for (const link of markdownLinks) {
    const [, destination] = link
    if (!destination.startsWith("/docs") && !destination.startsWith("#")) {
      continue
    }

    const [destinationPath, destinationHeading] = destination.split("#")
    const destinationSlug = destinationPath.startsWith("/docs/")
      ? destinationPath.slice("/docs/".length)
      : sourceSlug
    const targetPage =
      destinationPath === "/docs" ? undefined : pagesBySlug.get(destinationSlug)

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
  getMarkdown: (slug: string) => {
    const page = pagesBySlug.get(slug)
    if (!page) {
      return undefined
    }
    if (slug !== "plugin-server") {
      return cleanDocumentationMarkdown(
        page.rawContent,
        getDocumentationImageExtension
      )
    }

    return assembleDocumentationMarkdown({
      title: page.title,
      description: page.description,
      introduction: extractDocumentationSection(page.rawContent, "quickstart"),
      sections: [
        {
          title: "What is a Custom Plugin Server?",
          content: getPageByContentPath("plugin-server/what-is-a-plugin-server")
            .rawContent,
        },
        {
          level: 3,
          title: "What is a Plugin?",
          content: getPageByContentPath("plugin-server/what-is-a-plugin")
            .rawContent,
        },
        {
          title: "Create a Plugin Server with an agent",
          content: getPageByContentPath("plugin-server/agent-prompt")
            .rawContent,
        },
        {
          title: "Create a Plugin Server manually",
          content:
            "Follow the manual path when you want to understand or control each part of the implementation.",
        },
        {
          level: 3,
          title: "Prepare your development environment",
          content: getPageByContentPath("plugin-server/prerequisites")
            .rawContent,
        },
        {
          level: 3,
          title: "Generate the project",
          content: getPageByContentPath("plugin-server/create-plugin-server")
            .rawContent,
        },
        {
          level: 3,
          title: "Understand protocol version 1.0",
          content: getPageByContentPath("plugin-server/protocol-overview")
            .rawContent,
        },
        {
          level: 3,
          title: "Configure the manifest",
          content: getPageByContentPath("plugin-server/manifest").rawContent,
        },
        {
          level: 3,
          title: "Wire the shared routes",
          content: getPageByContentPath("plugin-server/hono-routes").rawContent,
        },
        {
          title: "Build a Plugin and return Media Nodes",
          content:
            "A Plugin recognizes one Source and converts its data into four product-level node types: playable item, folder, group, and unresolved item.",
        },
        {
          level: 3,
          title: "Add a Source Plugin",
          content: getPageByContentPath("plugin-server/plugins").rawContent,
        },
        {
          title: "Choose among the four node types",
          content: getPageByContentPath("plugin-server/media-nodes").rawContent,
        },
        {
          title: "Configure security and usage limits",
          content:
            "Create one secret API key for Lynvo, then define the finite usage limits enforced by your server.",
        },
        {
          level: 3,
          title: "Create the Plugin Server API key",
          content: getPageByContentPath("plugin-server/authentication")
            .rawContent,
        },
        {
          level: 3,
          title: "Define and enforce usage limits",
          content: getPageByContentPath("plugin-server/usage-limits")
            .rawContent,
        },
        {
          title: "Handle protocol requests and responses",
          content:
            "Validate every extraction request and return either normalized Media Nodes or a structured error.",
        },
        {
          level: 3,
          title: "Validate Extraction requests",
          content: getPageByContentPath("plugin-server/extraction-requests")
            .rawContent,
        },
        {
          level: 3,
          title: "Return successful responses",
          content: getPageByContentPath("plugin-server/success-responses")
            .rawContent,
        },
        {
          level: 3,
          title: "Return structured errors",
          content: getPageByContentPath("plugin-server/errors").rawContent,
        },
        {
          title: "Test, deploy, and connect",
          content:
            "Run the contract checks locally before deploying the Worker and adding it to Lynvo.",
        },
        {
          level: 3,
          title: "Test the protocol contract",
          content: getPageByContentPath("plugin-server/testing").rawContent,
        },
        {
          level: 3,
          title: "Deploy the Plugin Server",
          content: getPageByContentPath("plugin-server/deployment").rawContent,
        },
        {
          level: 3,
          title: "Connect the Plugin Server to Lynvo",
          content: getPageByContentPath("plugin-server/connect").rawContent,
        },
      ],
    })
  },
}

import { lazy } from "react"
import { Result, Schema } from "effect"

import pluginServerMeta from "./plugin-server/meta.json"
import rootMeta from "./meta.json"
import {
  assembleDocumentationMarkdown,
  extractDocumentationSection,
} from "./docs-markdown"

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

const getContentFileName = (path: string) =>
  path.slice(path.lastIndexOf("/") + 1, -".mdx".length)

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

const pagesByFileName = new Map<string, DocumentationPage>()
const pagesBySlug = new Map<string, DocumentationPage>()
const sourcePathBySlug = new Map<string, string>()

const getPageByFileName = (fileName: string) => {
  const page = pagesByFileName.get(fileName)
  if (!page) {
    throw new Error(`Documentation page is missing: ${fileName}`)
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
const pluginServerGroups = createGroups(pluginServerMeta.groups)
const orderedPages = [
  ...rootGroups[0].pages,
  ...pluginServerGroups.flatMap((group) => group.pages),
]

if (orderedPages.length !== pagesBySlug.size) {
  throw new Error("Every documentation page must appear once in navigation")
}

const getGroups = (
  page: DocumentationPage
): readonly DocumentationChapterGroup[] =>
  page.slug === "android-tv" ? [rootGroups[0]] : pluginServerGroups

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
      return
    }
    if (slug !== "plugin-server") {
      return page.rawContent
    }

    return assembleDocumentationMarkdown({
      title: page.title,
      description: page.description,
      introduction: extractDocumentationSection(page.rawContent, "quickstart"),
      sections: [
        {
          title: "What is a Custom Plugin Server?",
          content: getPageByFileName("what-is-a-plugin-server").rawContent,
        },
        {
          level: 3,
          title: "What is a Plugin?",
          content: getPageByFileName("what-is-a-plugin").rawContent,
        },
        {
          title: "Create a Plugin Server with an agent",
          content: getPageByFileName("agent-prompt").rawContent,
        },
        {
          title: "Create a Plugin Server manually",
          content:
            "Follow the manual path when you want to understand or control each part of the implementation.",
        },
        {
          level: 3,
          title: "Prepare your development environment",
          content: getPageByFileName("prerequisites").rawContent,
        },
        {
          level: 3,
          title: "Generate the project",
          content: getPageByFileName("create-plugin-server").rawContent,
        },
        {
          level: 3,
          title: "Understand protocol version 1.0",
          content: getPageByFileName("protocol-overview").rawContent,
        },
        {
          level: 3,
          title: "Configure the manifest",
          content: getPageByFileName("manifest").rawContent,
        },
        {
          level: 3,
          title: "Wire the shared routes",
          content: getPageByFileName("hono-routes").rawContent,
        },
        {
          title: "Build a Plugin and return Media Nodes",
          content:
            "A Plugin recognizes one Source and converts its data into 4 product-level node types: direct media, container, folder, and lazy folder.",
        },
        {
          level: 3,
          title: "Add a Source Plugin",
          content: getPageByFileName("plugins").rawContent,
        },
        {
          title: "Choose among the 4 node types",
          content: getPageByFileName("media-nodes").rawContent,
        },
        {
          title: "Configure security and usage limits",
          content:
            "Create one secret API key for Lynvo, then define the finite usage limits enforced by your server.",
        },
        {
          level: 3,
          title: "Create the Plugin Server API key",
          content: getPageByFileName("authentication").rawContent,
        },
        {
          level: 3,
          title: "Define and enforce usage limits",
          content: getPageByFileName("usage-limits").rawContent,
        },
        {
          title: "Handle protocol requests and responses",
          content:
            "Validate every extraction request and return either normalized Media Nodes or a structured error.",
        },
        {
          level: 3,
          title: "Validate Extraction requests",
          content: getPageByFileName("extraction-requests").rawContent,
        },
        {
          level: 3,
          title: "Return successful responses",
          content: getPageByFileName("success-responses").rawContent,
        },
        {
          level: 3,
          title: "Return structured errors",
          content: getPageByFileName("errors").rawContent,
        },
        {
          title: "Test, deploy, and connect",
          content:
            "Run the contract checks locally before deploying the Worker and adding it to Lynvo.",
        },
        {
          level: 3,
          title: "Test the protocol contract",
          content: getPageByFileName("testing").rawContent,
        },
        {
          level: 3,
          title: "Deploy the Plugin Server",
          content: getPageByFileName("deployment").rawContent,
        },
        {
          level: 3,
          title: "Connect the Plugin Server to Lynvo",
          content: getPageByFileName("connect").rawContent,
        },
      ],
    })
  },
}

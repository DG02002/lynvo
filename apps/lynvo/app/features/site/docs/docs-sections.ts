export type DocumentationSectionKey = DocumentationPageContext["section"]

export interface DocumentationSection {
  readonly key: DocumentationSectionKey
  readonly otherKey: DocumentationSectionKey
  readonly root: "/docs" | "/developer"
  readonly label: string
  readonly shortLabel: string
  readonly homeTitle: string
  readonly homeDescription: string
}

export const documentationSections: readonly DocumentationSection[] = [
  {
    key: "user",
    otherKey: "developer",
    root: "/docs",
    label: "Documentation",
    shortLabel: "Docs",
    homeTitle: "Lynvo Docs",
    homeDescription:
      "Save supported links and open them in the player you already use.",
  },
  {
    key: "developer",
    otherKey: "user",
    root: "/developer",
    label: "Developers",
    shortLabel: "Developer",
    homeTitle: "Developer Docs",
    homeDescription:
      "Build and connect a Lynvo-compatible Custom Plugin Server for the Sources you support.",
  },
]

const developerContentPrefix = "plugin-server/"
const legacyDeveloperSlug = developerContentPrefix.slice(0, -1)

export const getDocumentationContentPathKey = (path: string) =>
  path.slice("./".length, -".mdx".length)

export const getDocumentationSectionKeyForPath = (
  path: string
): DocumentationSectionKey =>
  getDocumentationContentPathKey(path).startsWith(developerContentPrefix)
    ? "developer"
    : "user"

export const getDocumentationSlug = (path: string) => {
  const contentPathKey = getDocumentationContentPathKey(path)
  return contentPathKey.startsWith(developerContentPrefix)
    ? contentPathKey.slice(developerContentPrefix.length)
    : contentPathKey
}

export const getDocumentationContentPath = (
  key: DocumentationSectionKey,
  slug: string
) => `./${key === "developer" ? developerContentPrefix : ""}${slug}.mdx`

const getDeveloperDocsRedirectSlug = (slug: string): string | undefined => {
  if (slug === legacyDeveloperSlug) {
    return ""
  }

  if (slug.startsWith(developerContentPrefix)) {
    return slug.slice(developerContentPrefix.length)
  }

  return undefined
}

// Slugs whose pages were merged into another page. The mapping keeps already
// published URLs as redirects instead of 404s.
const mergedDeveloperSlugs = new Set([
  "extraction-requests",
  "media-nodes",
  "success-responses",
])

const getMergedDeveloperDocsSlug = (slug: string): string | undefined =>
  mergedDeveloperSlugs.has(slug) ? "extract" : undefined

export const getDeveloperDocsRedirectSlugForSection = (
  section: DocumentationSectionKey,
  slug: string
): string | undefined =>
  section === "user"
    ? getDeveloperDocsRedirectSlug(slug)
    : getMergedDeveloperDocsSlug(slug)

export const getDocumentationSection = (key: DocumentationSectionKey) => {
  const section = documentationSections.find((item) => item.key === key)
  if (!section) {
    throw new Error(`Documentation section is missing: ${key}`)
  }
  return section
}

export const getDocumentationPageUrl = (
  key: DocumentationSectionKey,
  slug: string
) => `${getDocumentationSection(key).root}/${slug}`

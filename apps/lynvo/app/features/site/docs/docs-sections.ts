export type DocumentationSectionKey = DocumentationPageContext["section"]

export interface DocumentationSection {
  readonly key: DocumentationSectionKey
  readonly root: "/docs" | "/developer"
  readonly label: string
  readonly homeTitle: string
  readonly homeDescription: string
}

export const documentationSections: readonly DocumentationSection[] = [
  {
    key: "user",
    root: "/docs",
    label: "Documentation",
    homeTitle: "Lynvo Docs",
    homeDescription:
      "Save supported links and open them in the player you already use.",
  },
  {
    key: "developer",
    root: "/developer",
    label: "Developers",
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

export const getDeveloperDocsRedirectSlug = (
  slug: string
): string | undefined => {
  if (slug === legacyDeveloperSlug) {
    return ""
  }

  if (slug.startsWith(developerContentPrefix)) {
    return slug.slice(developerContentPrefix.length)
  }

  return undefined
}

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

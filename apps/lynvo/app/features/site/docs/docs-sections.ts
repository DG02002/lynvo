type DocumentationSectionKey = DocumentationPageContext["section"]

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
    homeTitle: "Lynvo documentation",
    homeDescription:
      "Save supported links and open them in the player you already use.",
  },
  {
    key: "developer",
    root: "/developer",
    label: "Developers",
    homeTitle: "Developer documentation",
    homeDescription:
      "Build and connect a Lynvo-compatible Custom Plugin Server for the Sources you support.",
  },
]

const developerContentPrefix = "./plugin-server/"

export const getDocumentationSectionKeyForPath = (
  path: string
): DocumentationSectionKey =>
  path.startsWith(developerContentPrefix) ? "developer" : "user"

export const getDocumentationSlug = (path: string) =>
  path.startsWith(developerContentPrefix)
    ? path.slice(developerContentPrefix.length, -".mdx".length)
    : path.slice("./".length, -".mdx".length)

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

export {}

declare global {
  const __BUILD_TIME__: string

  interface UsageMetric {
    id: string
    label: string
    used: number
    limit: number
    unit: string
    period: "daily" | "monthly"
    resetsAt: string
    sourceId?: string
  }

  interface ExternalWorkerUsage {
    workerId: string
    name: string
    iconUrl?: string
    sources?: readonly {
      id: string
      name: string
      iconUrl?: string
    }[]
    metrics: readonly UsageMetric[]
    error?: string
  }

  interface CookiePreferences {
    analytics: boolean
    marketingMeasurement: boolean
    personalizedMarketing: boolean
    version: number
  }

  interface DocumentationPage {
    slug: string
    url: string
    markdownUrl: string
    navLabel: string
    title: string
    description: string
    contentType: "Tutorial" | "How-to" | "Reference" | "Conceptual"
    lastModified: string
    headings: readonly DocumentationHeading[]
    rawContent: string
    Content: import("react").LazyExoticComponent<
      DocumentationMdxModule["default"]
    >
  }

  interface DocumentationHeading {
    id: string
    label: string
    level?: 3
  }

  interface DocumentationChapterGroup {
    group: string
    pages: readonly DocumentationPage[]
  }

  interface DocumentationPageContext {
    page: DocumentationPage
    groups: readonly DocumentationChapterGroup[]
    previous?: DocumentationPage
    next?: DocumentationPage
  }

  interface DocumentationFrontmatter {
    title: string
    description: string
    navLabel: string
    contentType: "Tutorial" | "How-to" | "Reference" | "Conceptual"
  }

  interface DocumentationMdxModule {
    default: import("react").ComponentType<{
      components?: import("mdx/types.js").MDXComponents
    }>
    frontmatter: DocumentationFrontmatter
  }

  interface DocumentationMetaGroup {
    title: string
    pages: readonly string[]
  }
}

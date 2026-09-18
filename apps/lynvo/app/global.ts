import type { MDXComponents } from "mdx/types.js"
import type { ComponentType, LazyExoticComponent } from "react"

import type { LynvoPlugin } from "~/features/site/settings/plugin-settings-data"

import type { PluginIconSource } from "./lib/plugin-icons"

declare global {
  const __BUILD_TIME__: string

  interface UsageReadInput {
    lynvoPlugins: readonly LynvoPlugin[]
  }

  interface UsageReadTotal {
    used: number
    limit: number
  }

  interface UsageReadEntry {
    key: string
    name: string
    used: number
    limit: number
    icon?: PluginIconSource
    iconUrl?: string
    iconKind: "hidden" | "source" | "direct"
  }

  interface UsageReadSection {
    total: UsageReadTotal
    resetsAt?: string
    entries: readonly UsageReadEntry[]
    failures: readonly string[]
  }

  interface UsageReadCustomGroup {
    key: string
    serverName: string
    iconUrl?: string
    remainingPercent: number
    resetsAt?: string
    entries: readonly UsageReadEntry[]
  }

  interface UsageReadCustomSection {
    groups: readonly UsageReadCustomGroup[]
    failures: readonly string[]
  }

  interface UsageReadSnapshot {
    lynvo: UsageReadSection
    custom: UsageReadCustomSection
  }

  interface UsageReadModule {
    read: (input: UsageReadInput) => Promise<UsageReadSnapshot>
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
    Content: LazyExoticComponent<DocumentationMdxModule["default"]>
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
    default: ComponentType<{ components?: MDXComponents }>
    frontmatter: DocumentationFrontmatter
  }

  interface DocumentationMetaGroup {
    title: string
    pages: readonly string[]
  }
}

import { Link, useParams } from "react-router"

import type { Route } from "./+types/_site.docs"
import DocsContent from "~/features/site/docs/external-extractors.mdx"
import { createDocsComponents } from "~/features/site/docs/docs-components"
import { cn } from "~/lib/utils"

const documentationGroups: readonly DocumentationChapterGroup[] = [
  {
    group: "Getting started",
    chapters: [
      {
        slug: "introduction",
        navLabel: "Introduction",
        title: "External extractors",
        description:
          "Learn what an external extractor does and how it works with Lynvo.",
      },
      {
        slug: "what-is-an-extractor",
        navLabel: "What Is an Extractor?",
        title: "What is an extractor?",
        description:
          "Understand the service that connects Lynvo to source-specific plugins.",
      },
      {
        slug: "what-is-a-plugin",
        navLabel: "What Is a Plugin?",
        title: "What is a plugin?",
        description:
          "Learn how a plugin recognizes one source and converts its pages into media nodes.",
      },
      {
        slug: "prerequisites",
        navLabel: "Prerequisites",
        title: "Prepare your development environment",
        description:
          "Install the tools and create the accounts you need before building an extractor.",
      },
      {
        slug: "create-worker",
        navLabel: "Create a Worker",
        title: "Create a Hono Cloudflare Worker",
        description:
          "Create the Worker project, configure Wrangler, and run it locally.",
      },
    ],
  },
  {
    group: "Build with an agent",
    chapters: [
      {
        slug: "agent-prompt",
        navLabel: "Generate the Boilerplate",
        title: "Generate an extractor Worker with an agent",
        description:
          "Copy this prompt into a coding agent to create the shared Worker before adding source plugins.",
      },
    ],
  },
  {
    group: "Build an extractor",
    chapters: [
      {
        slug: "protocol-overview",
        navLabel: "Protocol Overview",
        title: "Implement protocol version 1.0",
        description:
          "Understand the four endpoints that connect an external extractor to Lynvo.",
      },
      {
        slug: "authentication",
        navLabel: "Authentication",
        title: "Configure bearer authentication",
        description:
          "Protect extractor requests with a Worker API key and Cloudflare secrets.",
      },
      {
        slug: "manifest",
        navLabel: "Manifest",
        title: "Define the public manifest",
        description:
          "Declare your extractor’s identity, supported URLs, and capabilities.",
      },
      {
        slug: "source-adapters",
        navLabel: "Source Adapters",
        title: "Add a source adapter",
        description:
          "Organize source-specific matching and extraction without coupling it to your routes.",
      },
      {
        slug: "hono-routes",
        navLabel: "Hono Routes",
        title: "Wire the Hono routes",
        description:
          "Connect authentication, validation, usage enforcement, and extraction to the protocol endpoints.",
      },
    ],
  },
  {
    group: "Protocol reference",
    chapters: [
      {
        slug: "extraction-requests",
        navLabel: "Extraction Requests",
        title: "Validate extraction requests",
        description:
          "Validate source URLs, lazy nodes, source selection, and credentials.",
      },
      {
        slug: "media-nodes",
        navLabel: "Media Nodes",
        title: "Return normalized media nodes",
        description:
          "Represent playable items, folders, groups, and lazy nodes in Lynvo.",
      },
      {
        slug: "success-responses",
        navLabel: "Success Responses",
        title: "Return successful extraction responses",
        description:
          "Return normalized nodes with the source metadata Lynvo needs.",
      },
      {
        slug: "usage-limits",
        navLabel: "Usage Limits",
        title: "Define and enforce usage limits",
        description:
          "Report finite usage and prevent concurrent requests from exceeding a limit.",
      },
      {
        slug: "errors",
        navLabel: "Errors",
        title: "Return structured protocol errors",
        description:
          "Return stable error codes that Lynvo can display or act on.",
      },
    ],
  },
  {
    group: "Test and deploy",
    chapters: [
      {
        slug: "testing",
        navLabel: "Testing",
        title: "Test the protocol contract",
        description:
          "Verify every endpoint, response schema, and failure case before deployment.",
      },
      {
        slug: "deployment",
        navLabel: "Deployment",
        title: "Deploy the Worker",
        description:
          "Publish the extractor and verify its production manifest and authentication.",
      },
      {
        slug: "connect",
        navLabel: "Connect to Lynvo",
        title: "Connect the Worker to Lynvo",
        description:
          "Add the deployed Worker in Lynvo Settings and confirm its sources.",
      },
    ],
  },
]

const documentationPages = documentationGroups.flatMap(
  (documentationGroup) => documentationGroup.chapters
)

export function meta({ params }: Route.MetaArgs) {
  const activePage =
    documentationPages.find(
      (documentationPage) => documentationPage.slug === params["*"]
    ) ?? documentationPages[0]

  return [
    { title: `${activePage.title} | Lynvo Docs` },
    { name: "description", content: activePage.description },
    { name: "contentType", content: "Tutorial" },
  ]
}

export default function Docs() {
  const params = useParams()
  const activePage =
    documentationPages.find(
      (documentationPage) => documentationPage.slug === params["*"]
    ) ?? documentationPages[0]
  const pageDocsComponents = createDocsComponents(activePage.slug)

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
      <nav
        aria-label="Documentation"
        className="mb-8 flex gap-2 overflow-x-auto border-b pb-4 lg:hidden"
      >
        {documentationPages.map((documentationPage) => (
          <Link
            key={documentationPage.slug}
            to={`/docs/${documentationPage.slug}`}
            aria-current={
              documentationPage.slug === activePage.slug ? "page" : undefined
            }
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors",
              documentationPage.slug === activePage.slug
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {documentationPage.navLabel}
          </Link>
        ))}
      </nav>

      <div className="grid items-start gap-14 lg:grid-cols-[16rem_minmax(0,48rem)]">
        <aside className="hidden lg:block">
          <nav
            aria-label="Documentation"
            className="sticky top-24 flex flex-col gap-7"
          >
            {documentationGroups.map((documentationGroup) => (
              <div
                key={documentationGroup.group}
                className="flex flex-col gap-1"
              >
                <p className="mb-1 px-3 text-sm font-medium">
                  {documentationGroup.group}
                </p>
                {documentationGroup.chapters.map((documentationPage) => (
                  <Link
                    key={documentationPage.slug}
                    to={`/docs/${documentationPage.slug}`}
                    aria-current={
                      documentationPage.slug === activePage.slug
                        ? "page"
                        : undefined
                    }
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm transition-colors",
                      documentationPage.slug === activePage.slug
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    {documentationPage.navLabel}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <article className="min-w-0">
          <header className="flex flex-col gap-4 border-b pb-9">
            <h1 className="text-4xl font-normal tracking-tight text-balance md:text-5xl">
              {activePage.title}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              {activePage.description}
            </p>
          </header>

          <div className="docs-content flex flex-col gap-16 py-10">
            <DocsContent components={pageDocsComponents} />
          </div>
        </article>
      </div>
    </main>
  )
}

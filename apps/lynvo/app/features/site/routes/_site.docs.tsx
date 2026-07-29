import {
  ArrowRight01Icon,
  ModernTvIcon,
  ThreeDViewIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { lazy, Suspense, useEffect, useState } from "react"
import type { MouseEvent } from "react"
import { Link, useParams } from "react-router"

import type { Route } from "./+types/_site.docs"
import {
  createAndroidTvDocsComponents,
  docsComponents,
} from "~/features/site/docs/docs-components"
import {
  DOCS_SCROLL_END_TOLERANCE_PX,
  DOCS_SCROLL_OFFSET_PX,
} from "~/lib/constants"
import { cn } from "~/lib/utils"

const AndroidTvDocsContent = lazy(
  () => import("~/features/site/docs/android-tv.mdx")
)

const extractorDocsContentBySlug = {
  extractor: lazy(() => import("~/features/site/docs/extractor/extractor.mdx")),
  "what-is-an-extractor": lazy(
    () => import("~/features/site/docs/extractor/what-is-an-extractor.mdx")
  ),
  "what-is-a-plugin": lazy(
    () => import("~/features/site/docs/extractor/what-is-a-plugin.mdx")
  ),
  "agent-prompt": lazy(
    () => import("~/features/site/docs/extractor/agent-prompt.mdx")
  ),
  prerequisites: lazy(
    () => import("~/features/site/docs/extractor/prerequisites.mdx")
  ),
  "create-worker": lazy(
    () => import("~/features/site/docs/extractor/create-worker.mdx")
  ),
  "protocol-overview": lazy(
    () => import("~/features/site/docs/extractor/protocol-overview.mdx")
  ),
  authentication: lazy(
    () => import("~/features/site/docs/extractor/authentication.mdx")
  ),
  manifest: lazy(() => import("~/features/site/docs/extractor/manifest.mdx")),
  "source-adapters": lazy(
    () => import("~/features/site/docs/extractor/source-adapters.mdx")
  ),
  "extraction-requests": lazy(
    () => import("~/features/site/docs/extractor/extraction-requests.mdx")
  ),
  "media-nodes": lazy(
    () => import("~/features/site/docs/extractor/media-nodes.mdx")
  ),
  "success-responses": lazy(
    () => import("~/features/site/docs/extractor/success-responses.mdx")
  ),
  "usage-limits": lazy(
    () => import("~/features/site/docs/extractor/usage-limits.mdx")
  ),
  errors: lazy(() => import("~/features/site/docs/extractor/errors.mdx")),
  "hono-routes": lazy(
    () => import("~/features/site/docs/extractor/hono-routes.mdx")
  ),
  testing: lazy(() => import("~/features/site/docs/extractor/testing.mdx")),
  deployment: lazy(
    () => import("~/features/site/docs/extractor/deployment.mdx")
  ),
  connect: lazy(() => import("~/features/site/docs/extractor/connect.mdx")),
} as const

const isExtractorDocsSlug = (
  slug: string
): slug is keyof typeof extractorDocsContentBySlug =>
  slug in extractorDocsContentBySlug

const androidTvDocumentationGroups: readonly DocumentationChapterGroup[] = [
  {
    group: "Using Lynvo",
    chapters: [
      {
        slug: "android-tv",
        navLabel: "Android TV Setup",
        title: "Android TV Setup",
        description:
          "Install the recommended apps, open Lynvo in TV Bro, and sign in with a QR code.",
        contentType: "How-to",
        headings: [
          {
            id: "prepare-your-tv-and-phone",
            label: "Prepare your TV and phone",
          },
          { id: "open-lynvo-in-tv-bro", label: "Open Lynvo in TV Bro" },
          { id: "sign-in-with-a-qr-code", label: "Sign in with a QR code" },
          { id: "play-a-video", label: "Play a video" },
        ],
      },
    ],
  },
]

const extractorDocumentationGroups: readonly DocumentationChapterGroup[] = [
  {
    group: "Getting started",
    chapters: [
      {
        slug: "extractor",
        navLabel: "Extractor",
        title: "External extractors",
        description:
          "Learn what an external extractor does and how it works with Lynvo.",
        contentType: "Tutorial",
        headings: [
          {
            id: "build-and-connect-an-external-extractor",
            label: "Build and connect an external extractor",
          },
        ],
      },
      {
        slug: "what-is-an-extractor",
        navLabel: "What Is an Extractor?",
        title: "What is an extractor?",
        description:
          "Understand the service that connects Lynvo to source-specific plugins.",
        contentType: "Conceptual",
        headings: [
          {
            id: "the-extractor-is-the-service-lynvo-connects-to",
            label: "The extractor is the service Lynvo connects to",
          },
        ],
      },
      {
        slug: "what-is-a-plugin",
        navLabel: "What Is a Plugin?",
        title: "What is a plugin?",
        description:
          "Learn how a plugin recognizes one source and converts its pages into media nodes.",
        contentType: "Conceptual",
        headings: [
          {
            id: "a-plugin-adds-support-for-one-source",
            label: "A plugin adds support for one source",
          },
          {
            id: "how-extractors-and-plugins-fit-together",
            label: "How extractors and plugins fit together",
            level: 3,
          },
        ],
      },
      {
        slug: "prerequisites",
        navLabel: "Prerequisites",
        title: "Prepare your development environment",
        description:
          "Install the tools and create the accounts you need before building an extractor.",
        contentType: "Tutorial",
        headings: [
          {
            id: "prepare-your-development-environment",
            label: "Prepare your development environment",
          },
        ],
      },
      {
        slug: "create-worker",
        navLabel: "Create a Worker",
        title: "Create a Hono Cloudflare Worker",
        description:
          "Create the Worker project, configure Wrangler, and run it locally.",
        contentType: "Tutorial",
        headings: [
          {
            id: "create-a-hono-cloudflare-worker",
            label: "Create a Hono Cloudflare Worker",
          },
        ],
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
        contentType: "Tutorial",
        headings: [
          {
            id: "generate-the-external-worker-boilerplate",
            label: "Generate the external Worker boilerplate",
          },
        ],
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
        contentType: "Reference",
        headings: [
          {
            id: "implement-protocol-version-10",
            label: "Implement protocol version 1.0",
          },
        ],
      },
      {
        slug: "authentication",
        navLabel: "Authentication",
        title: "Configure bearer authentication",
        description:
          "Protect extractor requests with a Worker API key and Cloudflare secrets.",
        contentType: "Tutorial",
        headings: [
          {
            id: "configure-bearer-authentication",
            label: "Configure bearer authentication",
          },
        ],
      },
      {
        slug: "manifest",
        navLabel: "Manifest",
        title: "Define the public manifest",
        description:
          "Declare your extractor’s identity, supported URLs, and capabilities.",
        contentType: "Reference",
        headings: [
          {
            id: "define-the-public-manifest",
            label: "Define the public manifest",
          },
        ],
      },
      {
        slug: "source-adapters",
        navLabel: "Source Adapters",
        title: "Add a source adapter",
        description:
          "Organize source-specific matching and extraction without coupling it to your routes.",
        contentType: "Tutorial",
        headings: [
          { id: "add-a-source-adapter", label: "Add a source adapter" },
        ],
      },
      {
        slug: "hono-routes",
        navLabel: "Hono Routes",
        title: "Wire the Hono routes",
        description:
          "Connect authentication, validation, usage enforcement, and extraction to the protocol endpoints.",
        contentType: "Tutorial",
        headings: [
          { id: "wire-the-hono-routes", label: "Wire the Hono routes" },
        ],
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
        contentType: "Reference",
        headings: [
          {
            id: "validate-extraction-requests",
            label: "Validate extraction requests",
          },
        ],
      },
      {
        slug: "media-nodes",
        navLabel: "Media Nodes",
        title: "Return normalized media nodes",
        description:
          "Represent playable items, folders, groups, and lazy nodes in Lynvo.",
        contentType: "Reference",
        headings: [
          {
            id: "return-normalized-node-types",
            label: "Return normalized node types",
          },
          {
            id: "return-a-direct-playable-item",
            label: "Return a direct playable item",
            level: 3,
          },
          {
            id: "return-a-display-only-container",
            label: "Return a display-only container",
            level: 3,
          },
          {
            id: "return-a-selectable-folder",
            label: "Return a selectable folder",
            level: 3,
          },
          {
            id: "return-a-lazy-folder",
            label: "Return a lazy folder",
            level: 3,
          },
        ],
      },
      {
        slug: "success-responses",
        navLabel: "Success Responses",
        title: "Return successful extraction responses",
        description:
          "Return normalized nodes with the source metadata Lynvo needs.",
        contentType: "Reference",
        headings: [
          {
            id: "return-a-successful-extraction-response",
            label: "Return a successful extraction response",
          },
        ],
      },
      {
        slug: "usage-limits",
        navLabel: "Usage Limits",
        title: "Define and enforce usage limits",
        description:
          "Report finite usage and prevent concurrent requests from exceeding a limit.",
        contentType: "Reference",
        headings: [
          {
            id: "define-and-enforce-usage-limits",
            label: "Define and enforce usage limits",
          },
        ],
      },
      {
        slug: "errors",
        navLabel: "Errors",
        title: "Return structured protocol errors",
        description:
          "Return stable error codes that Lynvo can display or act on.",
        contentType: "Reference",
        headings: [
          {
            id: "return-structured-protocol-errors",
            label: "Return structured protocol errors",
          },
        ],
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
        contentType: "Tutorial",
        headings: [
          {
            id: "test-the-protocol-contract",
            label: "Test the protocol contract",
          },
        ],
      },
      {
        slug: "deployment",
        navLabel: "Deployment",
        title: "Deploy the Worker",
        description:
          "Publish the extractor and verify its production manifest and authentication.",
        contentType: "Tutorial",
        headings: [{ id: "deploy-the-worker", label: "Deploy the Worker" }],
      },
      {
        slug: "connect",
        navLabel: "Connect to Lynvo",
        title: "Connect the Worker to Lynvo",
        description:
          "Add the deployed Worker in Lynvo Settings and confirm its sources.",
        contentType: "Tutorial",
        headings: [
          {
            id: "connect-the-worker-to-lynvo",
            label: "Connect the Worker to Lynvo",
          },
        ],
      },
    ],
  },
]

const documentationGroups = [
  ...androidTvDocumentationGroups,
  ...extractorDocumentationGroups,
]

const documentationPages = documentationGroups.flatMap(
  (documentationGroup) => documentationGroup.chapters
)

export function meta({ params }: Route.MetaArgs) {
  if (!params["*"]) {
    return [
      { title: "Documentation | Lynvo" },
      {
        name: "description",
        content:
          "Choose a Lynvo guide for Android TV setup or external extractor development.",
      },
      { name: "contentType", content: "Landing" },
    ]
  }

  const activePage =
    documentationPages.find(
      (documentationPage) => documentationPage.slug === params["*"]
    ) ?? documentationPages[0]

  return [
    { title: `${activePage.title} | Lynvo Docs` },
    { name: "description", content: activePage.description },
    { name: "contentType", content: activePage.contentType },
  ]
}

const documentationCards = [
  {
    title: "Android TV Setup",
    description: "Set up Lynvo on Android TV with your phone.",
    to: "/docs/android-tv",
    icon: ModernTvIcon,
  },
  {
    title: "Extractor",
    description: "Build extractors that support your media sources.",
    to: "/docs/extractor",
    icon: ThreeDViewIcon,
  },
] as const

const DocsLanding = () => (
  <main className="mx-auto w-full max-w-5xl px-4 py-12 md:px-8 md:py-20">
    <div className="flex flex-col gap-12">
      <header className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <p className="text-sm">Documentation</p>
        <h1 className="py-4 text-4xl font-normal tracking-tight text-balance md:py-6 md:text-6xl">
          Lynvo for developers
        </h1>
        <p className="max-w-xl text-base leading-7 text-foreground text-pretty">
          Docs and resources to help you use, configure, and build with Lynvo.
        </p>
      </header>

      <section
        aria-label="Documentation guides"
        className="mx-auto grid w-full max-w-3xl gap-4 md:grid-cols-2"
      >
        {documentationCards.map((documentationCard) => (
          <Link
            key={documentationCard.to}
            to={documentationCard.to}
            viewTransition
            className="flex min-h-64 flex-col justify-between rounded-2xl bg-muted/35 p-6 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.07),0_8px_24px_-16px_rgba(0,0,0,0.2)] transition-[background-color,box-shadow,scale] duration-200 hover:bg-muted/60 hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1),0_18px_40px_-20px_rgba(0,0,0,0.3)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring active:scale-[0.96] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
          >
            <span className="flex size-12 items-center justify-center">
              <HugeiconsIcon
                icon={documentationCard.icon}
                className="size-8"
                strokeWidth={1.5}
              />
            </span>
            <span className="flex items-end justify-between gap-6">
              <span className="flex max-w-sm flex-col gap-2">
                <span className="text-2xl tracking-tight text-balance">
                  {documentationCard.title}
                </span>
                <span className="text-sm leading-6 text-muted-foreground text-pretty">
                  {documentationCard.description}
                </span>
              </span>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                aria-hidden="true"
                className="mb-1 size-5 shrink-0"
              />
            </span>
          </Link>
        ))}
      </section>
    </div>
  </main>
)

const DocsTableOfContents = ({
  headings,
}: {
  headings: readonly DocumentationHeading[]
}) => {
  const [activeHeadingId, setActiveHeadingId] = useState(headings[0]?.id ?? "")

  useEffect(() => {
    let animationFrameId: number | undefined

    const updateActiveHeading = () => {
      animationFrameId = undefined
      const headingElements = headings.flatMap((heading) => {
        const headingElement = document.getElementById(heading.id)
        return headingElement ? [headingElement] : []
      })

      if (headingElements.length === 0) {
        return
      }

      let nextActiveHeadingId = headingElements[0].id
      for (const headingElement of headingElements) {
        if (
          headingElement.getBoundingClientRect().top <= DOCS_SCROLL_OFFSET_PX
        ) {
          nextActiveHeadingId = headingElement.id
        } else {
          break
        }
      }

      const isAtPageEnd =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - DOCS_SCROLL_END_TOLERANCE_PX
      if (isAtPageEnd) {
        nextActiveHeadingId = headingElements.at(-1)?.id ?? nextActiveHeadingId
      }

      setActiveHeadingId((currentHeadingId) =>
        currentHeadingId === nextActiveHeadingId
          ? currentHeadingId
          : nextActiveHeadingId
      )
    }

    const requestActiveHeadingUpdate = () => {
      if (animationFrameId === undefined) {
        animationFrameId = window.requestAnimationFrame(updateActiveHeading)
      }
    }

    requestActiveHeadingUpdate()
    window.addEventListener("scroll", requestActiveHeadingUpdate, {
      passive: true,
    })
    window.addEventListener("resize", requestActiveHeadingUpdate)

    return () => {
      window.removeEventListener("scroll", requestActiveHeadingUpdate)
      window.removeEventListener("resize", requestActiveHeadingUpdate)
      if (animationFrameId !== undefined) {
        window.cancelAnimationFrame(animationFrameId)
      }
    }
  }, [headings])

  const handleHeadingClick = (
    event: MouseEvent<HTMLAnchorElement>,
    headingId: string
  ) => {
    const headingElement = document.getElementById(headingId)
    if (!headingElement) {
      return
    }

    event.preventDefault()
    setActiveHeadingId(headingId)
    headingElement.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    })
    window.history.pushState(null, "", `#${headingId}`)
  }

  return (
    <nav aria-label="On this page" className="sticky top-24 border-l pl-5">
      <ul className="flex flex-col gap-3">
        {headings.map((heading) => {
          const isActive = heading.id === activeHeadingId

          return (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                aria-current={isActive ? "location" : undefined}
                onClick={(event) => handleHeadingClick(event, heading.id)}
                className={cn(
                  "relative block text-sm leading-5 transition-colors before:absolute before:top-0 before:-left-[1.3125rem] before:h-full before:w-0.5 before:origin-center before:bg-foreground before:transition-[opacity,scale] before:duration-200",
                  heading.level === 3 && "pl-3",
                  isActive
                    ? "text-foreground before:scale-y-100 before:opacity-100"
                    : "text-muted-foreground before:scale-y-[0.25] before:opacity-0 hover:text-foreground"
                )}
              >
                {heading.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default function Docs() {
  const params = useParams()
  const requestedPageSlug = params["*"]

  if (!requestedPageSlug) {
    return <DocsLanding />
  }

  const activePage =
    documentationPages.find(
      (documentationPage) => documentationPage.slug === requestedPageSlug
    ) ?? documentationPages[0]
  const isAndroidTvDocumentation = activePage.slug === "android-tv"
  const activeDocumentationGroups = isAndroidTvDocumentation
    ? androidTvDocumentationGroups
    : extractorDocumentationGroups
  const activeDocumentationPages = activeDocumentationGroups.flatMap(
    (documentationGroup) => documentationGroup.chapters
  )
  const ActiveDocsContent = isAndroidTvDocumentation
    ? AndroidTvDocsContent
    : isExtractorDocsSlug(activePage.slug)
      ? extractorDocsContentBySlug[activePage.slug]
      : extractorDocsContentBySlug.extractor
  const pageDocsComponents = isAndroidTvDocumentation
    ? createAndroidTvDocsComponents()
    : docsComponents

  return (
    <main className="mx-auto w-full max-w-[90rem] px-4 py-8 md:px-8">
      <nav
        aria-label="Documentation"
        className="mb-8 flex gap-2 overflow-x-auto border-b pb-4 lg:hidden"
      >
        <Link
          to="/docs"
          className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Home
        </Link>
        {activeDocumentationPages.map((documentationPage) => (
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

      <div className="grid gap-10 lg:grid-cols-[14rem_minmax(0,48rem)] xl:grid-cols-[14rem_minmax(0,48rem)_13rem] xl:justify-center">
        <aside className="hidden lg:block">
          <nav
            aria-label="Documentation"
            className="sticky top-24 flex flex-col gap-7"
          >
            <Link
              to="/docs"
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              Docs home
            </Link>
            {activeDocumentationGroups.map((documentationGroup) => (
              <div
                key={documentationGroup.group}
                className="flex flex-col gap-1"
              >
                {isAndroidTvDocumentation ? null : (
                  <p className="mb-1 px-3 text-sm font-medium">
                    {documentationGroup.group}
                  </p>
                )}
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

        <article className="min-w-0 self-start">
          <header className="flex flex-col gap-4 pb-9">
            <h1 className="text-4xl font-normal tracking-tight text-balance md:text-5xl">
              {activePage.title}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              {activePage.description}
            </p>
          </header>

          <div className="docs-content flex flex-col gap-16 py-10">
            <Suspense fallback={null}>
              <ActiveDocsContent components={pageDocsComponents} />
            </Suspense>
          </div>
        </article>

        <aside className="hidden xl:block">
          <DocsTableOfContents headings={activePage.headings} />
        </aside>
      </div>
    </main>
  )
}

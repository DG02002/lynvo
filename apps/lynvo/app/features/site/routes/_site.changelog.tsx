import { Link } from "react-router"
import type { Route } from "./+types/_site.changelog"
import { Badge } from "~/components/ui/badge"
import { buttonVariants } from "~/components/ui/button"
import { cn } from "~/lib/utils"

interface ChangelogEntry {
  id: string
  date: string
  title: string
  category: "Product" | "Extractors" | "Platform"
  summary: string
  changes: string[]
}

const changelogEntries: ChangelogEntry[] = [
  {
    id: "product",
    date: "July 23, 2026",
    title: "New product resources",
    category: "Product",
    summary:
      "Lynvo now has dedicated product documentation, plan details, usage policies, and a public changelog.",
    changes: [
      "Added Lynvo Docs with an external extractor implementation guide",
      "Published transparent Free plan allowances and reset rules",
      "Added Usage Policies for responsible use and external extractor safety",
      "Made product resources available from the site navigation",
    ],
  },
  {
    id: "extractors",
    date: "July 2026",
    title: "External extractor protocol",
    category: "Extractors",
    summary:
      "Compatible external workers can now integrate through a small, authenticated JSON protocol.",
    changes: [
      "Added manifest, verification, usage, and extraction endpoints",
      "Added staged extraction for lazy folders and playable nodes",
      "Added finite extractor-owned usage reporting",
      "Published a tested Cloudflare Worker reference implementation",
    ],
  },
  {
    id: "platform",
    date: "July 2026",
    title: "Usage visibility and account controls",
    category: "Platform",
    summary:
      "Account and extractor capacity are easier to understand and manage.",
    changes: [
      "Separated official Lynvo allowances from external extractor capacity",
      "Added source-specific monthly usage limits",
      "Improved external worker configuration and manifest refresh controls",
    ],
  },
]

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Changelog | Lynvo" },
    {
      name: "description",
      content:
        "The latest Lynvo product updates, extractor protocol improvements, and platform changes.",
    },
  ]
}

export default function Changelog() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-16 md:px-8 md:py-24">
      <header className="flex max-w-3xl flex-col gap-5">
        <h1 className="text-4xl font-normal tracking-tight text-balance md:text-6xl">
          Lynvo changelog
        </h1>
        <p className="text-lg leading-8 text-muted-foreground">
          Product releases, extractor improvements, and the details behind what
          changed.
        </p>
        <nav aria-label="Changelog categories" className="flex flex-wrap gap-2">
          <a
            href="#all-updates"
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            All updates
          </a>
          <a
            href="#product"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Product
          </a>
          <a
            href="#extractors"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Extractors
          </a>
          <a
            href="#platform"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Platform
          </a>
        </nav>
      </header>

      <section id="all-updates" className="mt-16">
        <h2 className="sr-only">All updates</h2>
        <div className="flex flex-col">
          {changelogEntries.map((entry) => (
            <article
              key={`${entry.date}-${entry.title}`}
              id={entry.id}
              className="grid scroll-mt-24 gap-6 border-t py-12 first:border-t-0 md:grid-cols-[11rem_1fr] md:gap-10"
            >
              <div className="flex flex-row items-center gap-3 md:flex-col md:items-start">
                <time className="text-sm text-muted-foreground">
                  {entry.date}
                </time>
                <Badge variant="outline">{entry.category}</Badge>
              </div>
              <div className="flex max-w-2xl flex-col gap-5">
                <h3 className="text-2xl font-normal tracking-tight md:text-3xl">
                  {entry.title}
                </h3>
                <p className="leading-7 text-muted-foreground">
                  {entry.summary}
                </p>
                <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-6">
                  {entry.changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="mt-8 flex flex-col items-start gap-4 rounded-xl bg-muted/40 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <p className="font-medium">External extractor guide</p>
          <p className="text-sm text-muted-foreground">
            Follow the implementation guide and protocol contract.
          </p>
        </div>
        <Link
          to="/docs"
          viewTransition
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Read the docs
        </Link>
      </aside>
    </main>
  )
}

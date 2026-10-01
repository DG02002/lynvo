import {
  ArrowDown01Icon,
  ArrowLeft02Icon,
  ArrowRight02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Result, Schema } from "effect"
import { Fragment, useLayoutEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Separator } from "~/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { cn } from "~/lib/utils"

import type { Route } from "./+types/_site.changelog"

export interface ChangelogEntry {
  type: ChangelogType
  date: string
  dateTime: string
  title: string
  category: "Product" | "Plugin Server"
  description: readonly string[]
}

type ChangelogType = "general" | "plugin-server"
type ChangelogTab = ChangelogType | "all"
type SortOrder = "newest" | "oldest"

const changelogTabSchema = Schema.Literals(["all", "general", "plugin-server"])
const sortOrderSchema = Schema.Literals(["newest", "oldest"])

const INITIAL_ENTRY_COUNT = 5
const ENTRY_BATCH_SIZE = 5

const changelogEntries: ChangelogEntry[] = [
  {
    type: "general",
    date: "Sep 19, 2026",
    dateTime: "2026-09-19",
    title: "Hybrid view is now called Gallery view",
    category: "Product",
    description: [
      "Hybrid view, the Library’s grouped presentation, is now called Gallery view. A naming change only: grouping, Artwork, and season browsing are unchanged, and existing view preferences carry over automatically.",
      "No action is required. Choose List view or Gallery view anytime in Settings > General, under Saved links view.",
    ],
  },
  {
    type: "general",
    date: "Sep 10, 2026",
    dateTime: "2026-09-10",
    title: "Proxy keys now have their own settings tab",
    category: "Product",
    description: [
      "Supported Custom Plugin Servers can now use your own Scrape.do proxy key, managed from the new Settings > Proxy tab. Only Custom Plugin Servers that declare Scrape.do proxy support appear there.",
      'Add a key for each supported server, check its remaining Scrape.do balance, refresh the balance without re-entering the key, and turn "Use proxy key" on or off per server. Lynvo stores the key encrypted and sends it only to that server during Extraction while the switch is on.',
    ],
  },
  {
    type: "general",
    date: "Aug 31, 2026",
    dateTime: "2026-08-31",
    title: "The Library now has List view and Gallery view",
    category: "Product",
    description: [
      "The Library now has two views: List view shows each Saved link in a row, and Gallery view groups related movies and shows with posters and Artwork. Choose between them in Settings > General, under Saved links view.",
      "Gallery view groups a show by Season and Episode, with posters, season Artwork, and episode stills when available. A folder whose links belong to a single season opens straight into that season’s view.",
      'Nested folders keep their own names, sidecar files no longer create false media matches, and a mixed folder no longer takes a show’s name from its contents. Folder paths, back buttons, and the "Show episode names" control stay in sync while you browse.',
      'Turn "Save all links automatically" off to review what Extraction found and choose which Playable links belong in the Saved link. Refresh actions then read "Refresh link choices" because the new results wait for your selection.',
      'A Saved link shows "Waiting to load…" while Extraction is queued, "Loading links…" while it runs, and, when it fails, the returned error with Delete and View log actions.',
      'In Gallery view, "Change artwork" searches TMDB so you can pick different Artwork for a group, and a group’s menu can delete every link in it at once. The Library also lays out comfortably on smaller screens.',
      'Remote Play reconnects more reliably after stale connections. The Device picker now says when it is searching for Remote Play devices, when none are found, and when the list could not be loaded, with "Search again" to retry.',
      "Plugin Server usage now separates the Lynvo Plugin Server’s shared monthly allowance from each Custom Plugin Server’s own usage, with per-Plugin rows. Supported Custom Plugin Servers can use your own Scrape.do proxy key for Extraction.",
      "Plugin Server Protocol 0.1.5 adds typed errors, deferred Extraction for poll-based Sources, usage deltas per Extraction, vendor node extensions, and additive compatibility across wire version 1.x.",
      "Gallery view is beta, and TV Bro opens it by default until you choose another view. The in-app docs now cover Android TV sign-in, Plugin Server setup, and usage limits.",
    ],
  },
  {
    type: "general",
    date: "Aug 8, 2026",
    dateTime: "2026-08-08",
    title: "Link saving, deletion, and synchronization are now more reliable",
    category: "Product",
    description: [
      "Saving, deleting, and synchronizing Saved links is now more reliable, including for accounts with larger libraries.",
    ],
  },
  {
    type: "plugin-server",
    date: "Aug 8, 2026",
    dateTime: "2026-08-08",
    title:
      "Bhadoo’s Google Drive Index and OneDrive Vercel Index are now Lynvo Plugins",
    category: "Plugin Server",
    description: [
      "Bhadoo’s Google Drive Index and Spencerwooo’s OneDrive Vercel Index are now Lynvo Plugins, run by the Lynvo Plugin Server.",
      "Each Plugin’s usage is shown separately, and saving one of their page URLs extracts its playable files and unresolved items like any other supported Source.",
    ],
  },
  {
    type: "general",
    date: "Aug 8, 2026",
    dateTime: "2026-08-08",
    title: "Lynvo is now available",
    category: "Product",
    description: [
      "Lynvo is now available for saving the links you choose and browsing them by folder, on Android TV, Android phones, and Android tablets.",
      "Saved links open in Just (Video) Player, VLC for Android, MPV, or MX Player without typing a long media URL with a TV remote.",
      "Remote Play sends a Playable link from one signed-in session to another, and the receiving session opens it in its external Android player.",
    ],
  },
]

const changelogTypes = ["general", "plugin-server"] as const

const getSelectedTab = (value: string | null): ChangelogTab =>
  value === "general" || value === "plugin-server" ? value : "all"

const ChangelogDescription = ({
  description,
  id,
}: {
  description: readonly string[]
  id: string
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const descriptionRef = useRef<HTMLDivElement>(null)
  const paragraphOccurrences = new Map<string, number>()

  const getParagraphKey = (paragraph: string): string => {
    const occurrence = paragraphOccurrences.get(paragraph) ?? 0
    paragraphOccurrences.set(paragraph, occurrence + 1)
    return `${id}-${paragraph}-${occurrence}`
  }

  useLayoutEffect(() => {
    if (isExpanded) {
      return undefined
    }

    const element = descriptionRef.current
    if (!element) {
      return undefined
    }

    const measureOverflow = () => {
      setIsOverflowing(element.scrollHeight > element.clientHeight + 1)
    }

    measureOverflow()

    if (globalThis.ResizeObserver === undefined) {
      return undefined
    }

    const resizeObserver = new ResizeObserver(measureOverflow)
    resizeObserver.observe(element)

    return () => resizeObserver.disconnect()
  }, [
    // Re-measure after the rendered paragraphs change, even though the effect
    // only reads their layout through the DOM ref.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
    description,
    isExpanded,
  ])

  return (
    <div className="flex flex-col items-start gap-2">
      <div
        ref={descriptionRef}
        id={id}
        className={cn(
          "space-y-4 text-sm leading-6 text-muted-foreground text-pretty",
          !isExpanded && "line-clamp-3"
        )}
      >
        {description.map((paragraph) => (
          <p key={getParagraphKey(paragraph)}>{paragraph}</p>
        ))}
      </div>
      {isOverflowing ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-3 bg-transparent hover:bg-transparent"
          aria-controls={id}
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? "Show less" : "Show more"}
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            strokeWidth={2}
            data-icon="inline-end"
          />
        </Button>
      ) : null}
    </div>
  )
}

export const ChangelogList = ({ entries }: { entries: ChangelogEntry[] }) => {
  const [visibleCount, setVisibleCount] = useState(INITIAL_ENTRY_COUNT)
  const visibleEntries = entries.slice(0, visibleCount)
  const hasMoreEntries = visibleCount < entries.length

  return (
    <div className="flex flex-col">
      {visibleEntries.map((entry, index) => {
        const entryKey = `${entry.dateTime}-${entry.title}`

        return (
          <Fragment key={entryKey}>
            <article className="grid gap-5 py-8 md:grid-cols-[12rem_1fr] md:gap-12 md:py-14">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:flex-col md:items-start md:gap-3">
                <p className="text-sm font-medium">{entry.category}</p>
                <time
                  dateTime={entry.dateTime}
                  className="text-xs text-muted-foreground tabular-nums"
                >
                  {entry.date}
                </time>
                <Badge
                  className="ml-auto h-7 bg-lime-950 px-3 text-sm text-lime-200 md:ml-0"
                  aria-label="Stable"
                >
                  Stable
                </Badge>
              </div>
              <div className="flex max-w-3xl flex-col gap-3">
                <h2 className="text-base font-medium text-balance">
                  {entry.title}
                </h2>
                <ChangelogDescription
                  id={`description-${entryKey.replaceAll(" ", "-")}`}
                  description={entry.description}
                />
              </div>
            </article>
            {index < visibleEntries.length - 1 ? (
              <Separator className="bg-foreground/20" />
            ) : null}
          </Fragment>
        )
      })}
      {hasMoreEntries ? (
        <Button
          type="button"
          size="lg"
          className="mt-8 self-center"
          onClick={() =>
            setVisibleCount((current) => current + ENTRY_BATCH_SIZE)
          }
        >
          Load more
        </Button>
      ) : null}
    </div>
  )
}

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Changelog | Lynvo" },
    {
      name: "description",
      content: "What changed in Lynvo, newest first.",
    },
  ]
}

export default function Changelog() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest")
  const selectedTab = getSelectedTab(searchParams.get("type"))
  const sortedEntries = changelogEntries.toSorted((left, right) => {
    const dateComparison = left.dateTime.localeCompare(right.dateTime)
    return sortOrder === "newest" ? -dateComparison : dateComparison
  })

  const handleTabChange = (value: string | number) => {
    const nextTab = Schema.decodeUnknownResult(changelogTabSchema)(value)
    if (Result.isSuccess(nextTab)) {
      setSearchParams(
        nextTab.success === "all" ? {} : { type: nextTab.success }
      )
    }
  }

  return (
    <div className="w-full px-6 py-12 md:px-8 md:py-24 lg:px-10 xl:px-14">
      <header className="flex max-w-3xl flex-col gap-5">
        <h1 className="text-4xl font-normal text-balance md:text-6xl">
          Changelog
        </h1>
      </header>

      <Tabs
        value={selectedTab}
        onValueChange={handleTabChange}
        className="mt-8 gap-6 md:mt-10 md:gap-8"
      >
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <TabsList
            variant="line"
            aria-label="Changelog categories"
            className="w-fit max-w-full min-w-0 gap-4 p-0 sm:gap-6 md:gap-8"
          >
            <TabsTrigger
              value="all"
              className="h-11 min-w-0 flex-none p-0 text-sm after:hidden data-active:bg-transparent hover:bg-transparent sm:h-10 sm:text-base"
            >
              All
            </TabsTrigger>
            <TabsTrigger
              value="general"
              className="h-11 min-w-0 flex-none p-0 text-sm after:hidden data-active:bg-transparent hover:bg-transparent sm:h-10 sm:text-base"
            >
              Product
            </TabsTrigger>
            <TabsTrigger
              value="plugin-server"
              className="h-11 min-w-0 flex-none p-0 text-sm after:hidden data-active:bg-transparent hover:bg-transparent sm:h-10 sm:text-base"
            >
              Plugin Server
            </TabsTrigger>
          </TabsList>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button type="button" variant="ghost" size="sm" />}
              className="ml-auto min-h-11 px-2 sm:min-h-0 sm:px-3"
            >
              Sort
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                strokeWidth={2}
                data-icon="inline-end"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={sortOrder}
                onValueChange={(value) => {
                  const nextSortOrder =
                    Schema.decodeUnknownResult(sortOrderSchema)(value)
                  if (Result.isSuccess(nextSortOrder)) {
                    setSortOrder(nextSortOrder.success)
                  }
                }}
              >
                <DropdownMenuRadioItem
                  value="newest"
                  aria-label="Newest to oldest"
                >
                  <span>Newest</span>
                  <HugeiconsIcon icon={ArrowRight02Icon} strokeWidth={2} />
                  <span>Oldest</span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="oldest"
                  aria-label="Oldest to newest"
                >
                  <span>Oldest</span>
                  <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} />
                  <span>Newest</span>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <section aria-label="Changelog updates">
          <TabsContent value="all">
            <ChangelogList entries={sortedEntries} />
          </TabsContent>
          {changelogTypes.map((type) => (
            <TabsContent key={type} value={type}>
              <ChangelogList
                entries={sortedEntries.filter((entry) => entry.type === type)}
              />
            </TabsContent>
          ))}
        </section>
      </Tabs>
    </div>
  )
}

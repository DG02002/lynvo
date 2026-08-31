import {
  ArrowDown01Icon,
  ArrowLeft02Icon,
  ArrowRight02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Fragment, useLayoutEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router"
import type { Route } from "./+types/_site.changelog"
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
import { Result, Schema } from "effect"

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
    date: "Aug 31, 2026",
    dateTime: "2026-08-31",
    title: "The Save page now has List and Hybrid views",
    category: "Product",
    description: [
      "The Save page now has two views. List gives you row-by-row browsing. Hybrid groups movies and shows into artwork cards.",
      "Shows are grouped by season, with posters, season artwork, and episode stills when available. In Hybrid view, a folder with one season opens straight into a full-screen season view.",
      "Nested folders keep their own names, sidecar files do not create false media matches, and mixed folders do not borrow a show or episode name from their children. Folder paths, back buttons, and the Episode names control stay in sync.",
      'Saving is easier to follow. You can turn off "Save all links automatically", save a single playable mirror directly, and see whether an extraction is queued, loading, or failed. Failed items show the returned error with Delete and Log actions.',
      "You can search TMDB to change artwork, delete every link in a movie or show group, and browse the Save page comfortably on smaller screens.",
      "Remote Play reconnects more reliably after stale connections. The device picker explains when it is searching, has no devices, or needs another try.",
      "Plugin Server settings now separate shared Lynvo usage from per-server usage and let supported Scrape.do servers use your own proxy key. Protocol 0.1.5 adds typed errors, deferred extraction, usage changes, and additive fields.",
      "The docs now cover Android TV sign-in, Plugin Server setup, usage limits, and metadata providers.",
    ],
  },
  {
    type: "general",
    date: "Aug 8, 2026",
    dateTime: "2026-08-08",
    title: "More reliable link management",
    category: "Product",
    description: [
      "Improved reliability when saving, deleting, and synchronizing links, including accounts with larger libraries.",
    ],
  },
  {
    type: "plugin-server",
    date: "Aug 8, 2026",
    dateTime: "2026-08-08",
    title: "Lynvo Plugin Server",
    category: "Plugin Server",
    description: [
      "Added Lynvo-managed support for Bhadoo Google Drive and OneDrive indexes, with usage shown separately for each Plugin.",
    ],
  },
  {
    type: "general",
    date: "Aug 8, 2026",
    dateTime: "2026-08-08",
    title: "Product launch",
    category: "Product",
    description: [
      "Launched link saving and folder browsing, URL handoff to Just (Video) Player, VLC for Android, MPV, and MX Player on Android TV, Android phones, and Android tablets, plus Remote Play between signed-in devices.",
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

  useLayoutEffect(() => {
    if (isExpanded) {
      return
    }

    const element = descriptionRef.current
    if (!element) {
      return
    }

    const measureOverflow = () => {
      setIsOverflowing(element.scrollHeight > element.clientHeight + 1)
    }

    measureOverflow()

    if (globalThis.ResizeObserver === undefined) {
      return
    }

    const resizeObserver = new ResizeObserver(measureOverflow)
    resizeObserver.observe(element)

    return () => resizeObserver.disconnect()
  }, [description, isExpanded])

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
        {description.map((paragraph, index) => (
          <p key={`${id}-${index}`}>{paragraph}</p>
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
                  aria-label="General availability"
                >
                  GA
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
      content:
        "The latest Lynvo product updates and Plugin Server Protocol improvements.",
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
        <h1 className="text-4xl font-normal tracking-tight text-balance md:text-6xl">
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

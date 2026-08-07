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

export interface ChangelogEntry {
  type: ChangelogType
  date: string
  dateTime: string
  title: string
  category: "Product" | "Plugin Server" | "Platform"
  description: string
}

type ChangelogType = "general" | "plugin-server" | "platform"
type ChangelogTab = ChangelogType | "all"
type SortOrder = "newest" | "oldest"

const INITIAL_ENTRY_COUNT = 5
const ENTRY_BATCH_SIZE = 5

const changelogEntries: ChangelogEntry[] = [
  {
    type: "platform",
    date: "Jul 22, 2026",
    dateTime: "2026-07-22",
    title: "Platform foundation",
    category: "Platform",
    description:
      "Improved reliability when saving, deleting, and synchronizing links, including accounts with larger libraries.",
  },
  {
    type: "plugin-server",
    date: "Jul 19, 2026",
    dateTime: "2026-07-19",
    title: "Lynvo Plugin Server",
    category: "Plugin Server",
    description:
      "Added Lynvo-managed support for Bhadoo Google Drive and OneDrive indexes, with usage shown separately for each Plugin.",
  },
  {
    type: "general",
    date: "Jul 19, 2026",
    dateTime: "2026-07-19",
    title: "Product launch",
    category: "Product",
    description:
      "Launched link saving and folder browsing, URL handoff to Just (Video) Player, VLC for Android, MPV, and MX Player on Android TV, Android phones, and Android tablets, plus Remote Play between signed-in devices.",
  },
]

const changelogTypes = new Set<ChangelogType>([
  "general",
  "plugin-server",
  "platform",
])

const getSelectedTab = (value: string | null): ChangelogTab =>
  value && changelogTypes.has(value as ChangelogType)
    ? (value as ChangelogType)
    : "all"

const ChangelogDescription = ({
  description,
  id,
}: {
  description: string
  id: string
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const descriptionRef = useRef<HTMLParagraphElement>(null)

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

    if (typeof ResizeObserver === "undefined") {
      return
    }

    const resizeObserver = new ResizeObserver(measureOverflow)
    resizeObserver.observe(element)

    return () => resizeObserver.disconnect()
  }, [description, isExpanded])

  return (
    <div className="flex flex-col items-start gap-2">
      <p
        ref={descriptionRef}
        id={id}
        className={cn(
          "text-sm leading-6 text-muted-foreground text-pretty",
          !isExpanded && "line-clamp-3"
        )}
      >
        {description}
      </p>
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
            <article className="grid gap-6 py-10 md:grid-cols-[12rem_1fr] md:gap-12 md:py-14">
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm font-medium">{entry.category}</p>
                <time
                  dateTime={entry.dateTime}
                  className="text-xs text-muted-foreground tabular-nums"
                >
                  {entry.date}
                </time>
                <Badge
                  className="h-7 bg-lime-950 px-3 text-sm text-lime-200"
                  aria-label="General availability"
                >
                  GA
                </Badge>
              </div>
              <div className="flex max-w-3xl flex-col gap-3">
                <h3 className="text-base font-medium text-balance">
                  {entry.title}
                </h3>
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
        "The latest Lynvo product updates, Plugin Server Protocol improvements, and platform changes.",
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
    const nextTab = value as ChangelogTab
    setSearchParams(nextTab === "all" ? {} : { type: nextTab })
  }

  return (
    <div className="w-full px-6 py-16 md:px-8 md:py-24 lg:px-10 xl:px-14">
      <header className="flex max-w-3xl flex-col gap-5">
        <h1 className="text-4xl font-normal tracking-tight text-balance md:text-6xl">
          Changelog
        </h1>
      </header>

      <Tabs
        value={selectedTab}
        onValueChange={handleTabChange}
        className="mt-10 gap-8"
      >
        <div className="flex items-center justify-between gap-4">
          <TabsList
            variant="line"
            aria-label="Changelog categories"
            className="gap-6 p-0 md:gap-8"
          >
            <TabsTrigger
              value="all"
              className="h-10 p-0 text-base after:hidden data-active:bg-transparent hover:bg-transparent"
            >
              All updates
            </TabsTrigger>
            <TabsTrigger
              value="general"
              className="h-10 p-0 text-base after:hidden data-active:bg-transparent hover:bg-transparent"
            >
              Product
            </TabsTrigger>
            <TabsTrigger
              value="plugin-server"
              className="h-10 p-0 text-base after:hidden data-active:bg-transparent hover:bg-transparent"
            >
              Plugin Server
            </TabsTrigger>
            <TabsTrigger
              value="platform"
              className="h-10 p-0 text-base after:hidden data-active:bg-transparent hover:bg-transparent"
            >
              Platform
            </TabsTrigger>
          </TabsList>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button type="button" variant="ghost" size="sm" />}
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
                onValueChange={(value) => setSortOrder(value as SortOrder)}
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
          {Array.from(changelogTypes).map((type) => (
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

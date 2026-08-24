import { useMemo, useState } from "react"
import { Link } from "react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { Badge } from "~/components/ui/badge"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import type { ExtractedLink, LinkListItem } from "~/features/links/types"
import { projectTitleGroups } from "~/features/links/title-grouping/title-group-projection"
import {
  getMediaNodeInteractionState,
  getMediaNodeTargetOrUndefined,
} from "~/features/links/media-node-interaction"
import {
  getFolderIcon,
  getFolderVisualState,
  getLinkKey,
} from "~/components/save-list/save-list-browser-model"
import { TmdbImage } from "~/features/links/components/tmdb-image"
import { TMDB_ATTRIBUTION_LOGO_SRC } from "~/lib/constants"

interface TitleGroupDetailProps {
  readonly group: TitleGroupProjection
  readonly links: readonly LinkListItem[]
  readonly actions: LinkItemActions
}

interface FolderFrame {
  readonly label: string
  readonly children: readonly ExtractedLink[]
  readonly savedLinkUrl: string
}

const getSourceLabel = (source: SourceVariantProjection): string => {
  const details = [source.sourceName, source.quality, source.size].filter(
    (value): value is string => Boolean(value)
  )
  return details.join(" · ") || source.label
}

const getSourceStateLabel = (
  source: SourceVariantProjection
): string | undefined => {
  if (source.status === "down") {
    return "Unavailable"
  }
  if (source.mediaNodeKind === "resolvable") {
    return "Needs loading"
  }
  return undefined
}

const EpisodeRow = ({
  entry,
  source,
  stillPath,
  savedLink,
  actions,
  onFolderOpened,
}: {
  readonly entry: TitleEntryProjection
  readonly source: SourceVariantProjection
  readonly stillPath: string | undefined
  readonly savedLink: LinkListItem | undefined
  readonly actions: LinkItemActions
  readonly onFolderOpened: (frame: FolderFrame) => void
}) => {
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState(false)
  const stateLabel = getSourceStateLabel(source)

  const handleActivate = async () => {
    if (!savedLink || isWorking) {
      return
    }
    setIsWorking(true)
    setError(false)
    try {
      if (source.mediaNodeKind === "resolvable" && source.target) {
        const mirrors = await actions.expandMirror(savedLink.url, source.target)
        const firstMirror = mirrors?.find((mirror) => mirror.status !== "down")
        if (firstMirror) {
          await actions.play(firstMirror)
        } else {
          setError(true)
        }
      } else if (source.mediaNodeKind === "group" && source.target) {
        const children = await actions.expandFolder(
          savedLink.url,
          source.node.id ?? source.node.nodeKey ?? source.occurrenceKey,
          source.target
        )
        if (children) {
          onFolderOpened({
            label: source.label,
            children,
            savedLinkUrl: savedLink.url,
          })
        } else {
          setError(true)
        }
      } else {
        await actions.play(source.node)
      }
    } catch {
      setError(true)
    } finally {
      setIsWorking(false)
    }
  }

  const displayEpisodeNumber =
    entry.episodeStart !== undefined ? `EP ${entry.episodeStart}` : undefined

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${displayEpisodeNumber ?? ""} ${entry.displayLabel} ${source.sourceName}`.trim()}
      onClick={() => void handleActivate()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          void handleActivate()
        }
      }}
      className="group relative flex h-36 w-full shrink-0 cursor-pointer select-none items-stretch overflow-hidden rounded-3xl border border-border/60 bg-card text-left aria-disabled:cursor-not-allowed aria-disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-44 md:h-48 lg:h-52"
    >
      <div className="relative aspect-video h-full shrink-0 overflow-hidden bg-muted">
        {stillPath ? (
          <TmdbImage
            path={stillPath}
            variant="card"
            alt={`Still from ${entry.displayLabel}`}
          />
        ) : entry.metadataState === "pending" ? (
          <Skeleton className="size-full" />
        ) : (
          <div className="flex size-full items-center justify-center text-base text-muted-foreground">
            {entry.episodeStart !== undefined
              ? `EP ${entry.episodeStart}`
              : "No preview"}
          </div>
        )}
        {isWorking && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-xs">
            <Spinner className="size-7 text-foreground" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-6 py-4">
        <p className="font-heading text-base font-semibold leading-snug text-foreground sm:text-lg line-clamp-2">
          {entry.episodeStart !== undefined && entry.metadataTitle
            ? `${entry.episodeStart}. ${entry.metadataTitle}`
            : entry.displayLabel}
        </p>
        <p className="truncate text-xs text-muted-foreground sm:text-sm">
          {getSourceLabel(source)}
        </p>
        {stateLabel && (
          <Badge
            variant={source.status === "down" ? "destructive" : "secondary"}
            className="mt-1 w-fit"
          >
            {stateLabel}
          </Badge>
        )}
        {error && (
          <p className="mt-1 text-xs text-destructive" role="alert">
            This source could not be opened. Try again.
          </p>
        )}
      </div>
    </div>
  )
}

const FolderChildRow = ({
  child,
  isPending,
  didFail,
  onActivate,
}: {
  readonly child: ExtractedLink
  readonly isPending: boolean
  readonly didFail: boolean
  readonly onActivate: () => void
}) => {
  const childState = getMediaNodeInteractionState(child)
  return (
    <div className="animate-in fade-in fill-mode-both slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
      <button
        type="button"
        onClick={onActivate}
        data-folder-state={
          childState.isFolder ? getFolderVisualState(child, false) : undefined
        }
        className="flex w-full items-center gap-3 rounded-xl bg-background px-4 py-3 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <HugeiconsIcon
          icon={childState.isFolder ? getFolderIcon(child, false) : PlayIcon}
          className="size-4 shrink-0 text-muted-foreground"
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {child.label}
        </span>
        {child.size && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {child.size}
          </span>
        )}
        {isPending ? (
          <Spinner className="size-4" aria-label={`Loading ${child.label}…`} />
        ) : (
          childState.isFolder && (
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className="size-4 shrink-0 text-muted-foreground"
            />
          )
        )}
      </button>
      {didFail && (
        <p className="mt-1 px-4 text-xs text-destructive" role="alert">
          This item could not be opened. Try again.
        </p>
      )}
    </div>
  )
}

export const TitleGroupDetail = ({
  group,
  links,
  actions,
}: TitleGroupDetailProps) => {
  const [folderStack, setFolderStack] = useState<readonly FolderFrame[]>([])
  const [pendingFolderKey, setPendingFolderKey] = useState<string | null>(null)
  const [failedFolderKey, setFailedFolderKey] = useState<string | null>(null)
  const localProjection = useMemo(() => projectTitleGroups(links), [links])
  const localGroup = [
    ...localProjection.dateGroups.flatMap((dateGroup) => dateGroup.groups),
    ...localProjection.unmatchedGroups,
  ].find((candidate) => candidate.identityKey === group.identityKey)
  const groupEntriesByKey = new Map(
    group.entries.map((entry) => [entry.entryKey, entry])
  )
  const displayedGroup = localGroup
    ? {
        ...localGroup,
        ...group,
        entries: localGroup.entries.map((entry) => ({
          ...entry,
          ...groupEntriesByKey.get(entry.entryKey),
          sources: entry.sources,
        })),
      }
    : group
  const savedLinksById = new Map<string, LinkListItem>()
  for (const link of links) {
    if (link.id) {
      savedLinksById.set(link.id, link)
    }
  }

  const currentFolderFrame = folderStack.at(-1)

  const handleFolderChildActivate = async (child: ExtractedLink) => {
    const activeFrame = folderStack.at(-1)
    if (!activeFrame) {
      return
    }
    const childKey = getLinkKey(child)
    const childState = getMediaNodeInteractionState(child)
    const childTarget = getMediaNodeTargetOrUndefined(child)
    setFailedFolderKey(null)
    try {
      if (
        childState.kind === "resolvable" &&
        childState.resolutionKind === "mirrors" &&
        childTarget
      ) {
        setPendingFolderKey(childKey)
        const mirrors = await actions.expandMirror(
          activeFrame.savedLinkUrl,
          childTarget
        )
        const firstMirror = mirrors?.find((mirror) => mirror.status !== "down")
        if (firstMirror) {
          await actions.play(firstMirror)
        } else {
          setFailedFolderKey(childKey)
        }
        return
      }
      if (childState.isFolder) {
        setPendingFolderKey(childKey)
        const expandedChildren = child.children?.length
          ? child.children
          : childTarget
            ? await actions.expandFolder(
                activeFrame.savedLinkUrl,
                child.id ?? child.nodeKey ?? childKey,
                childTarget
              )
            : null
        if (expandedChildren) {
          setFolderStack((currentStack) => [
            ...currentStack,
            {
              label: child.label,
              children: expandedChildren,
              savedLinkUrl: activeFrame.savedLinkUrl,
            },
          ])
        } else {
          setFailedFolderKey(childKey)
        }
        return
      }
      await actions.play(child)
    } catch {
      setFailedFolderKey(childKey)
    } finally {
      setPendingFolderKey(null)
    }
  }

  return (
    <main className="flex h-svh w-full overflow-hidden bg-background">
      <Link
        to="/save"
        aria-label="Back to save"
        className="group flex h-full w-20 shrink-0 items-center justify-center text-muted-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-24 lg:w-28"
      >
        <HugeiconsIcon
          icon={ArrowLeft01Icon}
          className="size-9 transition-transform duration-200 group-hover:-translate-x-1 sm:size-11 md:size-12"
        />
      </Link>

      <div className="flex min-h-0 flex-1 gap-8 overflow-hidden md:gap-10 lg:gap-14">
        <section className="flex w-72 shrink-0 flex-col gap-6 overflow-y-auto px-4 py-6 lg:w-80 lg:py-8 xl:w-96">
          <div className="relative aspect-2/3 w-full overflow-hidden rounded-3xl border border-foreground/15 bg-muted">
            {displayedGroup.posterPath ? (
              <TmdbImage
                path={displayedGroup.posterPath}
                variant="detail"
                alt={`Poster for ${displayedGroup.displayTitle}`}
                isLazy={false}
              />
            ) : displayedGroup.metadataState === "pending" ? (
              <Skeleton className="size-full" />
            ) : (
              <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                No poster
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
              {displayedGroup.displayTitle}
            </h1>
            <p className="text-sm font-medium text-muted-foreground">
              {displayedGroup.mediaKind === "unmatched"
                ? "Unmatched source"
                : displayedGroup.mediaKind === "movie"
                  ? displayedGroup.year
                    ? `Movie · ${displayedGroup.year}`
                    : "Movie"
                  : displayedGroup.seasonNumber !== undefined
                    ? `Season ${displayedGroup.seasonNumber}`
                    : "TV season"}
            </p>
            {displayedGroup.metadataState === "pending" && (
              <Badge variant="secondary" className="w-fit gap-1.5">
                <Spinner className="size-3" />
                Finding metadata…
              </Badge>
            )}
            {displayedGroup.metadataState === "failed" && (
              <Badge variant="destructive" className="w-fit">
                Metadata lookup failed
              </Badge>
            )}
            {displayedGroup.metadataState === "unavailable" && (
              <Badge variant="secondary" className="w-fit">
                Metadata unavailable
              </Badge>
            )}
            {displayedGroup.provider === "tmdb" && (
              <img
                src={TMDB_ATTRIBUTION_LOGO_SRC}
                alt="Metadata by TMDB"
                className="mt-1 h-5 w-auto self-start"
                decoding="async"
              />
            )}
          </div>
        </section>

        <div
          id="title-entries"
          className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-2 py-6 pr-6 lg:py-8 lg:pr-8"
        >
          {currentFolderFrame && (
            <section className="rounded-2xl bg-muted/40 p-5 ring-1 ring-foreground/10">
              <nav
                aria-label="Folder path"
                className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
              >
                <button
                  type="button"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  onClick={() => {
                    setFolderStack([])
                    setFailedFolderKey(null)
                  }}
                >
                  {displayedGroup.displayTitle}
                </button>
                {folderStack.map((frame, frameIndex) => (
                  <span
                    key={`${frameIndex}-${frame.label}`}
                    className="flex items-center gap-2"
                  >
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                    {frameIndex < folderStack.length - 1 ? (
                      <button
                        type="button"
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                        onClick={() => {
                          setFolderStack((currentStack) =>
                            currentStack.slice(0, frameIndex + 1)
                          )
                          setFailedFolderKey(null)
                        }}
                      >
                        {frame.label}
                      </button>
                    ) : (
                      <span aria-current="page" className="text-foreground">
                        {frame.label}
                      </span>
                    )}
                  </span>
                ))}
              </nav>
              <div className="flex flex-col gap-2">
                {currentFolderFrame.children.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    This folder is empty.
                  </p>
                ) : (
                  currentFolderFrame.children.map((child, childIndex) => {
                    const childKey = getLinkKey(child)
                    return (
                      <FolderChildRow
                        key={`${childKey}-${childIndex}`}
                        child={child}
                        isPending={pendingFolderKey === childKey}
                        didFail={failedFolderKey === childKey}
                        onActivate={() => void handleFolderChildActivate(child)}
                      />
                    )
                  })
                )}
              </div>
            </section>
          )}

          {displayedGroup.entries.map((entry) => {
            return entry.sources.map((source) => (
              <EpisodeRow
                key={source.occurrenceKey}
                entry={entry}
                source={source}
                stillPath={entry.stillPath}
                savedLink={savedLinksById.get(source.savedLinkId)}
                actions={actions}
                onFolderOpened={(frame) => {
                  setFolderStack([frame])
                  setFailedFolderKey(null)
                }}
              />
            ))
          })}
        </div>
      </div>
    </main>
  )
}

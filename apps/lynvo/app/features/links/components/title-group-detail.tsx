import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cards01Icon,
  File01Icon,
  GridViewIcon,
  ListViewIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { NewBadge } from "~/components/save-list/new-badge"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"
import { LinkActionsDotMenu } from "~/components/links/link-actions-context-menu"
import { LinkItemMenu } from "~/components/links/link-item-menu"
import {
  MEDIA_LIST_ROW_TITLE_CLASS,
  MediaListRow,
  SAVE_LIST_ROW_ENTER_ANIMATION_CLASS,
  SaveListRowIcon,
} from "~/components/save-list/media-list-row"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import type { ExtractedLink, LinkListItem } from "~/features/links/types"
import { getSavedLinkInteractionState } from "~/features/links/saved-link-interaction"
import { projectTitleGroups } from "~/features/links/title-grouping/title-group-projection"
import {
  getMediaNodeInteractionState,
  getMediaNodeTargetOrUndefined,
} from "~/features/links/media-node-interaction"
import {
  getFolderIcon,
  getFolderVisualState,
  getItemTitle,
  getLinkKey,
} from "~/components/save-list/save-list-browser-model"
import { TmdbImage } from "~/features/links/components/tmdb-image"
import { TMDB_ATTRIBUTION_LOGO_SRC } from "~/lib/constants"
import { markAfterAcceptedHandoff } from "~/lib/opened-confirmation-events"
import { openInSpecificPlayer, type PlayerDefinition } from "~/lib/player-utils"
import { cn } from "~/lib/utils"

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

const getGroupSubtitle = (group: TitleGroupProjection): string => {
  if (group.mediaKind === "unmatched") {
    return "Unmatched source"
  }
  if (group.mediaKind === "movie") {
    return group.year ? `Movie · ${group.year}` : "Movie"
  }
  return group.seasonNumber !== undefined
    ? `Season ${group.seasonNumber}`
    : "TV season"
}

const EpisodeRow = ({
  entry,
  source,
  stillPath,
  savedLink,
  actions,
  onFolderOpened,
  isListView,
  isDirectMediaGroup,
  isNetflixGridView,
  isShowingRealFilename,
}: {
  readonly entry: TitleEntryProjection
  readonly source: SourceVariantProjection
  readonly stillPath: string | undefined
  readonly savedLink: LinkListItem | undefined
  readonly actions: LinkItemActions
  readonly onFolderOpened: (frame: FolderFrame) => void
  readonly isListView: boolean
  readonly isDirectMediaGroup: boolean
  readonly isNetflixGridView: boolean
  readonly isShowingRealFilename: boolean
}) => {
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState(false)
  const stateLabel = getSourceStateLabel(source)
  const sourceTarget =
    source.target ?? getMediaNodeTargetOrUndefined(source.node)
  const isCompactListView = isListView && isDirectMediaGroup
  const isNew =
    Boolean(savedLink) &&
    source.node.opened !== true &&
    (source.node.expiry === undefined || source.node.expiry > Date.now())

  const markOpenedAfterPlayback = (playbackResult: PlaybackHandoffResult) => {
    if (!savedLink || !sourceTarget) {
      return
    }
    markAfterAcceptedHandoff({
      ...playbackResult,
      itemLabel: source.label,
      markOpened: () => actions.markOpened(savedLink.url, sourceTarget),
    })
  }

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
          const playbackResult = await actions.play(firstMirror)
          markOpenedAfterPlayback(playbackResult)
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
        const playbackResult = await actions.play(source.node)
        markOpenedAfterPlayback(playbackResult)
      }
    } catch {
      setError(true)
    } finally {
      setIsWorking(false)
    }
  }

  const handleCopyLink = () => {
    if (sourceTarget) {
      void navigator.clipboard.writeText(sourceTarget)
    }
  }

  const handleOpenInPlayer = async (player: PlayerDefinition) => {
    if (!sourceTarget) {
      return
    }
    const result = await openInSpecificPlayer(sourceTarget, player)
    if (savedLink) {
      markAfterAcceptedHandoff({
        accepted: result.expectsNavigation,
        itemLabel: source.label,
        markOpened: () => actions.markOpened(savedLink.url, sourceTarget),
      })
    }
  }

  const displayEpisodeNumber =
    !isShowingRealFilename && entry.episodeStart !== undefined
      ? `EP ${entry.episodeStart}`
      : undefined
  const displayEpisodeTitle = isShowingRealFilename
    ? source.label
    : (entry.metadataTitle ?? entry.displayLabel)
  const displayTitle =
    !isShowingRealFilename && entry.episodeStart !== undefined
      ? `${entry.episodeStart}. ${displayEpisodeTitle}`
      : displayEpisodeTitle
  const rowLabel = `${displayEpisodeNumber ?? ""} ${
    isShowingRealFilename ? displayEpisodeTitle : entry.displayLabel
  } ${source.sourceName}`.trim()

  if (isCompactListView) {
    return (
      <MediaListRow
        wrapperClassName="w-full shrink-0 border-b-0"
        buttonClassName="md:px-6"
        overlayClassName="md:right-6"
        dataLayoutGuideTarget="fullscreen-row"
        label={rowLabel}
        icon={
          <SaveListRowIcon>
            {isWorking ? (
              <Spinner className="size-6" />
            ) : (
              <HugeiconsIcon icon={PlayIcon} className="size-6" />
            )}
          </SaveListRowIcon>
        }
        title={
          <p
            className={cn(
              MEDIA_LIST_ROW_TITLE_CLASS,
              "line-clamp-2 font-heading leading-snug"
            )}
          >
            {displayTitle}
          </p>
        }
        meta={
          <>
            <p className="truncate text-xs text-muted-foreground">
              {getSourceLabel(source)}
            </p>
            {isNew && <NewBadge className="mt-2 md:hidden" />}
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
          </>
        }
        trailing={
          isNew ? (
            <NewBadge className="relative z-10 hidden shrink-0 md:inline-flex" />
          ) : undefined
        }
        overlay={
          sourceTarget ? (
            <LinkActionsDotMenu
              itemLabel={source.label}
              onCopyLink={handleCopyLink}
              onOpenInPlayer={handleOpenInPlayer}
              isPlayable={
                source.mediaNodeKind === "playable" && source.status !== "down"
              }
              className="size-9 shrink-0 text-foreground"
            />
          ) : undefined
        }
        onActivate={() => void handleActivate()}
        disabled={!savedLink || isWorking}
      />
    )
  }

  return (
    <article
      className={cn(
        "group relative w-full shrink-0",
        isCompactListView
          ? "flex min-h-24 w-full items-center"
          : isListView
            ? "flex h-36 items-stretch overflow-hidden rounded-3xl border border-foreground/15 bg-muted sm:h-44 md:h-48 lg:h-52"
            : isNetflixGridView
              ? "flex min-h-0 flex-col gap-4"
              : "flex aspect-[4/3] min-h-0 flex-col overflow-hidden rounded-3xl border border-foreground/15 bg-muted"
      )}
      data-layout-guide-target="fullscreen-row"
    >
      <button
        type="button"
        aria-label={rowLabel}
        disabled={!savedLink || isWorking}
        onClick={() => void handleActivate()}
        className={cn(
          "group/episode relative flex min-w-0 flex-1 cursor-pointer select-none text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          isCompactListView
            ? "items-center gap-3 px-4 py-6 pr-16 font-normal hover:bg-muted"
            : isListView
              ? "items-stretch overflow-hidden"
              : "overflow-hidden flex-col gap-4"
        )}
      >
        {isCompactListView ? (
          <span className="pointer-events-none flex size-10 shrink-0 items-center justify-center text-foreground md:size-14">
            {isWorking ? (
              <Spinner className="size-6" />
            ) : (
              <HugeiconsIcon icon={PlayIcon} className="size-6" />
            )}
          </span>
        ) : (
          <div
            className={cn(
              "relative shrink-0 overflow-hidden bg-muted",
              isListView
                ? "aspect-video h-full"
                : isNetflixGridView
                  ? "aspect-video w-full rounded-2xl border border-foreground/15"
                  : "absolute inset-0 size-full"
            )}
          >
            {stillPath ? (
              <TmdbImage
                path={stillPath}
                variant={isListView ? "card" : "wide-card"}
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
        )}

        {!isListView && !isNetflixGridView && (
          <div
            aria-hidden="true"
            className="library-episode-material pointer-events-none absolute inset-0 z-10"
          />
        )}

        <div
          className={cn(
            "relative flex min-w-0 flex-1 flex-col justify-center",
            isCompactListView
              ? "gap-1"
              : isListView
                ? "gap-1.5 px-6 py-4 pr-16"
                : isNetflixGridView
                  ? "gap-1.5 px-2 pb-2 pr-12 text-foreground"
                  : "gap-1.5 absolute inset-x-0 bottom-0 z-20 justify-end px-5 pb-5 pt-16 text-white sm:pt-20"
          )}
        >
          {!isListView && !isNetflixGridView && (
            <div
              aria-hidden="true"
              className="library-episode-legibility pointer-events-none absolute inset-x-0 -top-10 bottom-0 z-0"
            />
          )}
          <div className="relative z-10 min-w-0">
            {!isListView && !isNetflixGridView && displayEpisodeNumber && (
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/75">
                {displayEpisodeNumber}
              </p>
            )}
            <p
              className={cn(
                "line-clamp-2 font-heading leading-snug",
                isDirectMediaGroup
                  ? "text-sm font-normal md:text-lg"
                  : "text-base font-semibold sm:text-lg",
                isListView || isNetflixGridView
                  ? "text-foreground"
                  : "text-white"
              )}
            >
              {isListView || isNetflixGridView
                ? displayTitle
                : displayEpisodeTitle}
            </p>
            <p
              className={cn(
                "truncate text-xs",
                !isDirectMediaGroup && "sm:text-sm",
                isListView || isNetflixGridView
                  ? "text-muted-foreground"
                  : "text-white/70"
              )}
            >
              {getSourceLabel(source)}
            </p>
            {isListView && isNew && <NewBadge className="mt-2 md:hidden" />}
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
        {isListView && isNew && (
          <NewBadge className="relative z-10 hidden shrink-0 md:inline-flex" />
        )}
      </button>

      {(sourceTarget || (!isListView && isNew)) && (
        <div
          className={cn(
            "absolute z-30 flex items-center justify-center",
            isCompactListView
              ? "inset-y-0 end-0 w-16 border-s border-border/70"
              : isListView
                ? "right-4 top-1/2 -translate-y-1/2"
                : isNetflixGridView
                  ? "bottom-2 right-0"
                  : "right-3 top-3"
          )}
        >
          {!isListView && isNew && <NewBadge />}
          {sourceTarget && (
            <LinkActionsDotMenu
              itemLabel={source.label}
              onCopyLink={handleCopyLink}
              onOpenInPlayer={handleOpenInPlayer}
              isPlayable={
                source.mediaNodeKind === "playable" && source.status !== "down"
              }
              className={cn(
                isCompactListView
                  ? "size-full! rounded-none! bg-transparent text-foreground shadow-none hover:bg-muted aria-expanded:bg-muted dark:hover:bg-muted/50 [&_svg]:size-7!"
                  : "size-10 shrink-0 rounded-full bg-background/90 text-foreground shadow-none hover:bg-background/95 aria-expanded:bg-background/95 dark:hover:bg-background/90 [&_svg]:size-7!"
              )}
            />
          )}
        </div>
      )}
    </article>
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
    <div className={SAVE_LIST_ROW_ENTER_ANIMATION_CLASS}>
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
  const navigate = useNavigate()
  const [folderStack, setFolderStack] = useState<readonly FolderFrame[]>([])
  const [pendingFolderKey, setPendingFolderKey] = useState<string | null>(null)
  const [failedFolderKey, setFailedFolderKey] = useState<string | null>(null)
  const [isListView, setIsListView] = useState(true)
  const [isNetflixGridView, setIsNetflixGridView] = useState(false)
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
  const headerSavedLink =
    displayedGroup.entries
      .flatMap((entry) => entry.sources)
      .map((source) => savedLinksById.get(source.savedLinkId))
      .find((link): link is LinkListItem => Boolean(link)) ?? links[0]
  const displayedSourceCount = displayedGroup.entries.reduce(
    (totalSourceCount, entry) => totalSourceCount + entry.sources.length,
    0
  )
  const isDirectMediaGroup =
    displayedSourceCount === 1 &&
    (displayedGroup.mediaKind === "movie" ||
      displayedGroup.mediaKind === "unmatched") &&
    headerSavedLink !== undefined &&
    getSavedLinkInteractionState(headerSavedLink, Date.now()).directLink !==
      undefined
  const [isShowingRealFilename, setIsShowingRealFilename] =
    useState(isDirectMediaGroup)
  useEffect(() => {
    setIsShowingRealFilename(isDirectMediaGroup)
  }, [group.identityKey, isDirectMediaGroup])
  const headerFolderName = headerSavedLink
    ? getItemTitle(headerSavedLink)
    : undefined
  const headerRealFilename = displayedGroup.entries
    .flatMap((entry) => entry.sources)
    .find((source) => source.label)?.label
  const headerDisplayName = isDirectMediaGroup
    ? (headerRealFilename ?? headerFolderName)
    : headerFolderName
  const shouldShowFolderName = Boolean(
    isShowingRealFilename && headerDisplayName
  )
  const headerTitle = shouldShowFolderName
    ? (headerDisplayName ?? displayedGroup.displayTitle)
    : displayedGroup.displayTitle
  const headerSubtitle = shouldShowFolderName
    ? undefined
    : getGroupSubtitle(displayedGroup)

  const currentFolderFrame = folderStack.at(-1)

  const handleListGridToggle = () => {
    setIsNetflixGridView(false)
    setIsListView((currentValue) => !currentValue)
  }

  const handleNetflixGridToggle = () => {
    setIsListView(false)
    setIsNetflixGridView((currentValue) => !currentValue)
  }

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
    <main
      className="flex h-svh w-full overflow-hidden bg-background"
      data-layout-guide-target="fullscreen-frame"
    >
      <Link
        to="/save"
        aria-label="Back to save"
        data-layout-guide-target="fullscreen-back"
        className="group flex w-16 shrink-0 items-center justify-center text-muted-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-20 md:w-24"
      >
        <HugeiconsIcon
          icon={ArrowLeft01Icon}
          className="size-9 transition-transform duration-200 group-hover:-translate-x-1 sm:size-11 md:size-12"
        />
      </Link>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className="flex min-h-16 shrink-0 items-center gap-3 border-b bg-background px-4 py-3 md:px-6"
          data-layout-guide-target="fullscreen-header"
        >
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-normal">{headerTitle}</h1>
            {headerSubtitle && (
              <p className="truncate text-xs text-muted-foreground">
                {headerSubtitle}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {!isDirectMediaGroup && (
              <>
                <Button
                  type="button"
                  variant={isListView ? "secondary" : "ghost"}
                  size="icon"
                  aria-label={
                    isListView ? "Switch to grid view" : "Switch to list view"
                  }
                  aria-pressed={isListView}
                  title={
                    isListView ? "Switch to grid view" : "Switch to list view"
                  }
                  onClick={handleListGridToggle}
                >
                  <HugeiconsIcon
                    icon={isListView ? GridViewIcon : ListViewIcon}
                    className="size-5"
                  />
                </Button>
                <Button
                  type="button"
                  variant={isNetflixGridView ? "secondary" : "ghost"}
                  size="icon"
                  aria-label={
                    isNetflixGridView
                      ? "Use image overlay grid"
                      : "Use card grid"
                  }
                  aria-pressed={isNetflixGridView}
                  title={
                    isNetflixGridView
                      ? "Use image overlay grid"
                      : "Use card grid"
                  }
                  onClick={handleNetflixGridToggle}
                >
                  <HugeiconsIcon icon={Cards01Icon} className="size-5" />
                </Button>
              </>
            )}
            {!isDirectMediaGroup && (
              <Button
                type="button"
                variant={isShowingRealFilename ? "secondary" : "ghost"}
                size="sm"
                aria-label={
                  isShowingRealFilename
                    ? "Show episode titles"
                    : "Show real filenames"
                }
                aria-pressed={isShowingRealFilename}
                title={
                  isShowingRealFilename
                    ? "Show episode titles"
                    : "Show real filenames"
                }
                onClick={() =>
                  setIsShowingRealFilename((currentValue) => !currentValue)
                }
              >
                <HugeiconsIcon icon={File01Icon} className="size-4" />
                <span className="hidden sm:inline">Real filename</span>
              </Button>
            )}
            {headerSavedLink && (
              <LinkItemMenu
                item={headerSavedLink}
                actions={actions}
                showRemove
                onRemoved={() => navigate("/save")}
                triggerClassName="size-10 rounded-full bg-background/90 shadow-none hover:bg-background/95 aria-expanded:bg-background/95 dark:hover:bg-background/90 [&_svg]:size-7!"
              />
            )}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          <section
            className="flex w-full shrink-0 items-start gap-4 overflow-x-auto border-b px-4 py-4 md:w-72 md:flex-col md:gap-6 md:overflow-x-hidden md:overflow-y-auto md:border-b-0 md:border-r md:px-6 md:py-6 lg:w-80 lg:py-8 xl:w-96"
            data-layout-guide-target="fullscreen-sidebar"
          >
            <div className="relative aspect-2/3 w-28 shrink-0 overflow-hidden rounded-3xl border border-foreground/15 bg-muted md:w-full">
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
            <div className="flex min-w-0 flex-col gap-3 md:w-full">
              <p className="font-heading text-2xl font-normal tracking-tight md:text-3xl">
                {displayedGroup.displayTitle}
              </p>
              <p className="text-sm font-medium text-muted-foreground">
                {getGroupSubtitle(displayedGroup)}
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
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto",
              isDirectMediaGroup
                ? "gap-0 px-0 py-0"
                : "gap-5 px-4 py-5 md:px-6 md:py-6 lg:py-8 lg:pr-8"
            )}
            data-layout-guide-target="fullscreen-entries"
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
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        className="size-4"
                      />
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
                          onActivate={() =>
                            void handleFolderChildActivate(child)
                          }
                        />
                      )
                    })
                  )}
                </div>
              </section>
            )}

            <div
              className={cn(
                "min-w-0",
                isListView
                  ? isDirectMediaGroup
                    ? "flex flex-col divide-y divide-border/70"
                    : "flex flex-col gap-6"
                  : isNetflixGridView
                    ? "grid grid-cols-1 gap-x-6 gap-y-8 lg:grid-cols-2 2xl:grid-cols-3"
                    : "grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3"
              )}
            >
              {displayedGroup.entries.map((entry) => {
                return entry.sources.map((source) => (
                  <EpisodeRow
                    key={source.occurrenceKey}
                    entry={entry}
                    source={source}
                    stillPath={entry.stillPath}
                    savedLink={savedLinksById.get(source.savedLinkId)}
                    actions={actions}
                    isListView={isListView}
                    isDirectMediaGroup={isDirectMediaGroup}
                    isNetflixGridView={isNetflixGridView}
                    isShowingRealFilename={isShowingRealFilename}
                    onFolderOpened={(frame) => {
                      setFolderStack([frame])
                      setFailedFolderKey(null)
                    }}
                  />
                ))
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

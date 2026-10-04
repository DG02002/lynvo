import {
  AlertCircleIcon,
  Folder01Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo } from "react"

import { ExpandableFilename } from "~/components/expandable-filename"
import { LinkItemMenu } from "~/components/links/link-item-menu"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { toLinkViewModel } from "~/features/links/link-view-models"
import {
  getGalleryItemLabel,
  getMediaArtworkRequest,
  getMediaDisplayTitle,
  hasEpisodeMarker,
  parseMediaFilename,
  type GalleryGroup,
} from "~/features/links/media-artwork"
import { getMediaNodeTargetOrUndefined } from "~/features/links/media-node-interaction"
import { openInPlayerAndLogError } from "~/features/links/open-in-player"
import { getSavedLinkInteractionState } from "~/features/links/saved-link-interaction"
import type { LinkListItem } from "~/features/links/types"
import { useCurrentTimeMs } from "~/lib/use-coarse-time-bucket"

import {
  getExtractionStatusInput,
  getExtractionStatusTitleSpec,
} from "./extraction-status-utils"
import {
  FinderEpisodeStillDisplay,
  useFinderEpisodeStill,
  useFinderSeasonPoster,
} from "./finder-episode-still"
import { GalleryGroupMenu } from "./gallery-group-menu"
import {
  MediaListRow,
  MediaListRowMeta,
  SaveListRowIcon,
} from "./media-list-row"
import {
  MEDIA_LIST_HEADER_MENU_CELL_CLASS,
  MEDIA_LIST_ROW_MENU_TRIGGER_CLASS,
} from "./media-list-row-constants"
import { PlayableExpiryBadge } from "./playable-expiry-badge"
import {
  FolderTitleDisplayToggleButton,
  SaveListBackButton,
} from "./save-list-header-controls"
import {
  GALLERY_GROUP_CONTENT_CLASS,
  GALLERY_GROUP_EPISODE_STILL_SLOT_CLASS,
  SAVE_LIST_IMMERSIVE_HEADER_GRID_CLASS,
} from "./save-list-layout-constants"
import { SeasonArtworkPanel } from "./season-artwork-panel"
import { useFolderTitleDisplay } from "./use-folder-title-display"

interface GalleryGroupItemRowProps {
  readonly item: LinkListItem
  readonly actions: LinkItemActions
  readonly isExtracting: boolean
  readonly currentTimeMs: number
  readonly onOpenItem: (itemUrl: string) => void
  readonly itemLabel: string
  readonly displayTitle: string
  readonly titleDisplay: FolderTitleDisplay
  readonly shouldShowRowArtwork: boolean
  readonly artworkSource: GalleryItemArtworkSource | undefined
}

const GalleryGroupItemRow = ({
  item,
  actions,
  isExtracting,
  currentTimeMs,
  onOpenItem,
  itemLabel,
  displayTitle,
  titleDisplay,
  shouldShowRowArtwork,
  artworkSource,
}: GalleryGroupItemRowProps) => {
  const interactionState = getSavedLinkInteractionState(item, currentTimeMs)
  const { directLink, isDirectLinkExpired } = interactionState
  const extractionState = item.extractionStatus?.state ?? "complete"
  const isExtractionVisual =
    getExtractionStatusInput(item, isExtracting) !== "idle"
  const view = toLinkViewModel(item)
  const directLinkTarget = directLink
    ? getMediaNodeTargetOrUndefined(directLink)
    : undefined
  const rowFallbackIcon = isExtractionVisual ? (
    <SaveListRowIcon>
      {extractionState === "failed" ? (
        <HugeiconsIcon icon={AlertCircleIcon} className="size-6" />
      ) : (
        <span
          aria-hidden="true"
          className="loading-skeleton-pulse inline-flex text-muted-foreground"
        >
          <HugeiconsIcon icon={Folder01Icon} className="size-6" />
        </span>
      )}
    </SaveListRowIcon>
  ) : (
    <SaveListRowIcon
      className={isDirectLinkExpired ? "text-muted-foreground" : undefined}
    >
      <HugeiconsIcon
        icon={directLink ? PlayIcon : Folder01Icon}
        className="size-6"
      />
    </SaveListRowIcon>
  )
  const isSeasonFolder = artworkSource?.kind === "season"
  const episodeStill = useFinderEpisodeStill(
    artworkSource?.kind === "episode" ? artworkSource.label : itemLabel,
    undefined,
    shouldShowRowArtwork && artworkSource?.kind === "episode"
  )
  const seasonPoster = useFinderSeasonPoster(
    artworkSource?.kind === "season" ? artworkSource.request : undefined
  )
  const rowArtwork = isSeasonFolder ? seasonPoster : episodeStill
  const seasonFolderFallbackIcon = (
    <SaveListRowIcon>
      <HugeiconsIcon icon={Folder01Icon} className="size-6" />
    </SaveListRowIcon>
  )
  // Season folder labels stay intact when the episode-title toggle is on.
  const rowDisplayTitle =
    titleDisplay === "episode" && artworkSource?.kind === "episode"
      ? episodeStill.episodeDisplayTitle
      : displayTitle
  const shouldShowNewBadge =
    !isDirectLinkExpired && !isExtractionVisual && interactionState.isNew
  const shouldCenterMobileNewBadge =
    shouldShowRowArtwork &&
    artworkSource?.kind === "episode" &&
    titleDisplay === "episode"

  const handleActivate = () => {
    if (isExtractionVisual) {
      return
    }
    if (directLink) {
      openInPlayerAndLogError(() => actions.play(directLink), {
        itemLabel: directLink.label,
        markOpened: () => {
          if (directLinkTarget !== undefined) {
            actions.markOpened(item.url, directLinkTarget)
          }
        },
      })
      return
    }
    actions.markOpened(item.url, item.url)
    onOpenItem(item.url)
  }

  return (
    <MediaListRow
      label={rowDisplayTitle}
      icon={
        shouldShowRowArtwork ? (
          <span className={GALLERY_GROUP_EPISODE_STILL_SLOT_CLASS}>
            <FinderEpisodeStillDisplay
              label={itemLabel}
              fallbackIcon={
                isSeasonFolder ? seasonFolderFallbackIcon : rowFallbackIcon
              }
              isResolving={isExtractionVisual}
              isDimmed={isDirectLinkExpired}
              isWatched={directLink?.opened === true}
              imagePath={rowArtwork.imagePath}
              imageType={rowArtwork.imageType}
              isLookupPending={rowArtwork.isLookupPending}
            />
          </span>
        ) : (
          rowFallbackIcon
        )
      }
      title={{
        value: rowDisplayTitle,
        isStruckThrough: isDirectLinkExpired,
      }}
      titleExtractionStatus={getExtractionStatusTitleSpec(item, isExtracting)}
      meta={
        <>
          <MediaListRowMeta
            sourceName={view.sourceName || view.pluginName || item.url}
            size={directLink?.size}
            itemCount={directLink ? undefined : view.extractedLinks.length}
          />
          {directLink?.expiry !== undefined && (
            <PlayableExpiryBadge
              expiresAt={directLink.expiry}
              expirySource={directLink.expirySource}
            />
          )}
        </>
      }
      newBadge={
        shouldShowNewBadge
          ? {
              mobilePlacement: shouldCenterMobileNewBadge
                ? "centered"
                : "metadata",
            }
          : undefined
      }
      overlay={
        <LinkItemMenu
          item={item}
          actions={actions}
          playableLink={directLink}
          isPlayableLinkExpired={isDirectLinkExpired}
          showRemove
          isRefreshing={isExtracting}
          triggerClassName={MEDIA_LIST_ROW_MENU_TRIGGER_CLASS}
        />
      }
      onActivate={handleActivate}
      disabled={directLink !== undefined && isDirectLinkExpired}
      isOpened={directLink?.opened === true}
      shouldStackIconOnMobile={shouldShowRowArtwork}
    />
  )
}

interface GalleryItemEpisodeStillSource {
  readonly kind: "episode"
  readonly label: string
}

interface GalleryItemSeasonPosterSource {
  readonly kind: "season"
  readonly request: NonNullable<ReturnType<typeof getMediaArtworkRequest>>
}

type GalleryItemArtworkSource =
  | GalleryItemEpisodeStillSource
  | GalleryItemSeasonPosterSource

// Episode rows use their own still. A season folder uses the season request
// from its label, without borrowing artwork from any extracted child.
const getItemArtworkSource = (
  itemLabel: string
): GalleryItemArtworkSource | undefined => {
  if (hasEpisodeMarker(itemLabel)) {
    return { kind: "episode", label: itemLabel }
  }
  const request = getMediaArtworkRequest(itemLabel)
  return request?.mediaKind === "tv" && request.episodeNumber === undefined
    ? { kind: "season", request }
    : undefined
}

interface GalleryGroupBrowserProps {
  readonly group: GalleryGroup
  readonly actions: LinkItemActions
  readonly extractingItems: Set<string>
  readonly currentTimeMs?: number
  readonly onExit: () => void
  readonly onOpenItem: (itemUrl: string) => void
}

export const GalleryGroupBrowser = ({
  group,
  actions,
  extractingItems,
  currentTimeMs: currentTimeMsInput,
  onExit,
  onOpenItem,
}: GalleryGroupBrowserProps) => {
  const currentTimeMs = useCurrentTimeMs(currentTimeMsInput)
  const [titleDisplay, toggleTitleDisplay] = useFolderTitleDisplay("episode")
  const itemLabels = useMemo(
    () => group.items.map((item) => getGalleryItemLabel(item)),
    [group.items]
  )
  const itemArtworkSources = useMemo(
    () => itemLabels.map((itemLabel) => getItemArtworkSource(itemLabel)),
    [itemLabels]
  )
  const canShowEpisodeNames =
    group.artworkRequest?.mediaKind === "tv" &&
    itemArtworkSources.some((source) => source?.kind === "episode")
  const groupTitleDisplay = canShowEpisodeNames ? titleDisplay : "filename"
  const sortedItemEntries = useMemo(() => {
    const itemEntries = group.items.map((item, itemIndex) => ({
      item,
      itemLabel: itemLabels[itemIndex] ?? "",
      artworkSource: itemArtworkSources[itemIndex],
      originalIndex: itemIndex,
    }))
    if (!canShowEpisodeNames) {
      return itemEntries
    }
    return itemEntries.toSorted(
      (firstEntry, secondEntry) =>
        (parseMediaFilename(firstEntry.itemLabel).episodeNumber ??
          firstEntry.originalIndex) -
        (parseMediaFilename(secondEntry.itemLabel).episodeNumber ??
          secondEntry.originalIndex)
    )
  }, [group.items, itemLabels, itemArtworkSources, canShowEpisodeNames])

  return (
    <section className="flex h-svh flex-col overflow-hidden bg-background">
      <header className={SAVE_LIST_IMMERSIVE_HEADER_GRID_CLASS}>
        <SaveListBackButton onNavigateBack={onExit} />
        <div className="min-w-0 md:flex md:w-full md:items-center md:px-4 md:py-3">
          <h1
            aria-label={group.displayTitle}
            className="hidden w-full min-w-0 text-base font-normal md:block"
          >
            <ExpandableFilename
              value={group.displayTitle}
              clampClassName="line-clamp-1"
              className="w-full"
            />
          </h1>
        </div>
        {canShowEpisodeNames ? (
          <div className="flex items-center justify-center px-1 md:px-0">
            <FolderTitleDisplayToggleButton
              titleDisplay={titleDisplay}
              onToggle={toggleTitleDisplay}
            />
          </div>
        ) : null}
        <div className={MEDIA_LIST_HEADER_MENU_CELL_CLASS}>
          <GalleryGroupMenu group={group} actions={actions} onExit={onExit} />
        </div>
      </header>
      <div className={GALLERY_GROUP_CONTENT_CLASS}>
        <div className="border-b bg-muted/50 p-4 md:block md:border-b-0 md:border-r md:p-6 dark:bg-transparent">
          <SeasonArtworkPanel
            displayTitle={group.displayTitle}
            artworkRequest={group.artworkRequest}
          />
        </div>
        <div className="min-h-0 md:overflow-x-hidden md:overflow-y-auto md:overscroll-x-none md:overscroll-y-contain">
          <div className="stagger-children flex flex-col divide-y divide-border/70">
            {sortedItemEntries.map(({ item, itemLabel, artworkSource }) => {
              const displayTitle =
                artworkSource?.kind === "season" ||
                groupTitleDisplay !== "episode"
                  ? itemLabel
                  : (getMediaDisplayTitle(itemLabel) ?? itemLabel)

              return (
                <GalleryGroupItemRow
                  key={item.id ?? item.url}
                  item={item}
                  actions={actions}
                  isExtracting={extractingItems.has(item.url)}
                  currentTimeMs={currentTimeMs}
                  onOpenItem={onOpenItem}
                  itemLabel={itemLabel}
                  displayTitle={displayTitle}
                  titleDisplay={groupTitleDisplay}
                  shouldShowRowArtwork={
                    group.artworkRequest?.mediaKind === "tv" &&
                    artworkSource !== undefined
                  }
                  artworkSource={artworkSource}
                />
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

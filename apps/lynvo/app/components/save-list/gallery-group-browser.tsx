import { useMemo } from "react"
import type { MediaArtworkRequest } from "~shared/api-contracts"

import { ExpandableFilename } from "~/components/expandable-filename"
import { LinkItemMenu } from "~/components/links/link-item-menu"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { toLinkViewModel } from "~/features/links/link-view-models"
import {
  getGalleryItemLabel,
  getMediaArtworkRequest,
  getMediaDisplayTitle,
  hasEpisodeMarker,
  type GalleryGroup,
} from "~/features/links/media-artwork"
import { openPlayableAndMarkOpened } from "~/features/links/open-in-player"
import { getSavedLinkInteractionState } from "~/features/links/saved-link-interaction"
import type { LinkListItem } from "~/features/links/types"
import { useCurrentTimeMs } from "~/lib/use-coarse-time-bucket"

import {
  getExtractionStatusInput,
  getExtractionStatusTitleSpec,
} from "./extraction-status-utils"
import {
  FinderArtworkDisplay,
  useFinderArtwork,
  useFinderEpisodeStill,
} from "./finder-media-artwork"
import { GalleryGroupMenu } from "./gallery-group-menu"
import {
  MediaListRow,
  MediaListRowMeta,
  getSaveListItemFallbackIcon,
  SaveListItemFallbackIcon,
  SaveListRowIcon,
} from "./media-list-row"
import { getShouldCenterMobileNewBadge } from "./new-badge"
import { PlayableExpiryBadge } from "./playable-expiry-badge"
import { compareByEpisodeNumber } from "./save-list-browser-model"
import { FolderTitleDisplayToggleButton } from "./save-list-header-controls"
import {
  GALLERY_GROUP_CONTENT_CLASS,
  GALLERY_GROUP_EPISODE_STILL_SLOT_CLASS,
} from "./save-list-layout-constants"
import { useSaveListSession } from "./save-list-session"
import {
  ImmersiveBrowserHeader,
  SeasonArtworkAside,
} from "./save-list-shared-layout"
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
  const extractionStatus = getExtractionStatusInput(item, isExtracting)
  const isExtractionVisual = extractionStatus !== "idle"
  const view = toLinkViewModel(item)
  const fallbackIconDescriptor = getSaveListItemFallbackIcon(
    extractionStatus,
    directLink !== undefined
  )
  const rowFallbackIcon = (
    <SaveListRowIcon
      className={
        fallbackIconDescriptor.isExtractionVisual || !isDirectLinkExpired
          ? undefined
          : "text-muted-foreground"
      }
    >
      <SaveListItemFallbackIcon descriptor={fallbackIconDescriptor} />
    </SaveListRowIcon>
  )
  const isSeasonFolder = artworkSource?.kind === "season"
  const isEpisodeRow = artworkSource?.kind === "episode"
  const episodeStill = useFinderEpisodeStill(
    isEpisodeRow ? artworkSource.label : itemLabel,
    undefined,
    shouldShowRowArtwork && isEpisodeRow
  )
  const seasonPoster = useFinderArtwork(
    isSeasonFolder ? artworkSource.request : undefined,
    "poster"
  )
  const rowArtwork = isSeasonFolder ? seasonPoster : episodeStill
  const rowDisplayTitle =
    titleDisplay === "episode" && isEpisodeRow
      ? episodeStill.episodeDisplayTitle
      : displayTitle
  const shouldShowNewBadge =
    !isDirectLinkExpired && !isExtractionVisual && interactionState.isNew
  const shouldCenterMobileNewBadge = getShouldCenterMobileNewBadge(
    shouldShowRowArtwork && isEpisodeRow,
    titleDisplay
  )

  const handleActivate = () => {
    if (isExtractionVisual) {
      return
    }
    if (directLink) {
      void openPlayableAndMarkOpened({
        actions,
        itemUrl: item.url,
        playableLink: directLink,
        open: () => actions.play(directLink),
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
            <FinderArtworkDisplay
              label={itemLabel}
              fallbackIcon={rowFallbackIcon}
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
      title={{ value: rowDisplayTitle }}
      titleExtractionStatus={getExtractionStatusTitleSpec(item, isExtracting)}
      meta={
        <>
          <MediaListRowMeta
            sourceName={view.sourceName || view.pluginName || item.url}
            size={directLink?.size}
            itemCount={directLink ? undefined : view.extractedLinks.length}
          />
          {directLink?.expiry !== undefined && (
            <PlayableExpiryBadge expiresAt={directLink.expiry} />
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
          showRemove
          showChangeArtwork={false}
          isRefreshing={isExtracting}
          triggerLook="media-row"
        />
      }
      onActivate={handleActivate}
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
  readonly request: MediaArtworkRequest
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
  readonly currentTimeMs?: number
  readonly onExit: () => void
  readonly onOpenItem: (itemUrl: string) => void
}

export const GalleryGroupBrowser = ({
  group,
  currentTimeMs: currentTimeMsInput,
  onExit,
  onOpenItem,
}: GalleryGroupBrowserProps) => {
  const { actions, extractingItems } = useSaveListSession()
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
    return itemEntries.toSorted((firstEntry, secondEntry) =>
      compareByEpisodeNumber(
        {
          label: firstEntry.itemLabel,
          originalIndex: firstEntry.originalIndex,
        },
        {
          label: secondEntry.itemLabel,
          originalIndex: secondEntry.originalIndex,
        }
      )
    )
  }, [group.items, itemLabels, itemArtworkSources, canShowEpisodeNames])

  return (
    <section className="flex h-svh flex-col overflow-hidden bg-background">
      <ImmersiveBrowserHeader
        onNavigateBack={onExit}
        title={
          <div className="min-w-0 md:flex md:w-full md:items-center md:px-4 md:py-3">
            <h1
              aria-label={group.displayTitle}
              className="hidden w-full min-w-0 text-lg font-medium tracking-tight md:block"
            >
              <ExpandableFilename
                value={group.displayTitle}
                clampClassName="line-clamp-1"
                className="w-full"
              />
            </h1>
          </div>
        }
        center={
          canShowEpisodeNames ? (
            <div className="flex items-center justify-center px-1 md:px-0">
              <FolderTitleDisplayToggleButton
                titleDisplay={titleDisplay}
                onToggle={toggleTitleDisplay}
              />
            </div>
          ) : null
        }
        menu={
          <GalleryGroupMenu
            group={group}
            actions={actions}
            onExit={onExit}
            triggerLook="media-row"
          />
        }
      />
      <div className={GALLERY_GROUP_CONTENT_CLASS}>
        <SeasonArtworkAside as="div" className="md:block">
          <SeasonArtworkPanel
            displayTitle={group.displayTitle}
            artworkRequest={group.artworkRequest}
          />
        </SeasonArtworkAside>
        <div className="min-h-0 md:overflow-x-hidden md:overflow-y-auto md:overscroll-x-none md:overscroll-y-contain">
          <div className="stagger-children flex flex-col divide-y divide-border/70">
            {sortedItemEntries.map(({ item, itemLabel, artworkSource }) => {
              const displayTitle =
                groupTitleDisplay === "episode"
                  ? (getMediaDisplayTitle(itemLabel) ?? itemLabel)
                  : itemLabel

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

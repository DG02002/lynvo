import { useMemo } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  Folder01Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { FilenameText } from "~/components/filename-text"
import { LinkItemMenu } from "~/components/links/link-item-menu"
import { Spinner } from "~/components/spinner"
import { TmdbImage } from "~/features/links/components/tmdb-image"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { toLinkViewModel } from "~/features/links/link-view-models"
import {
  getMediaDisplayTitle,
  getMediaEpisodeDisplayTitle,
  hasEpisodeMarker,
} from "~/features/links/media-artwork/media-artwork-identity"
import { getMediaNodeTargetOrUndefined } from "~/features/links/media-node-interaction"
import { getHybridItemLabel } from "~/features/links/media-artwork/hybrid-card-grouping"
import { parseMediaFilename } from "~/features/links/media-artwork/media-filename-parser"
import { useMediaArtwork } from "~/features/links/media-artwork/use-media-artwork"
import { getSavedLinkInteractionState } from "~/features/links/saved-link-interaction"
import type { LinkListItem } from "~/features/links/types"
import { markAfterAcceptedHandoff } from "~/lib/opened-confirmation-events"
import { SaveExtractionStatus } from "./extraction-status"
import { getExtractionStatusInput } from "./extraction-status-utils"
import {
  FinderEpisodeStillDisplay,
  useFinderEpisodeStill,
} from "./finder-episode-still"
import {
  MediaListRow,
  MediaListRowMeta,
  SaveListRowIcon,
} from "./media-list-row"
import {
  MEDIA_LIST_ROW_MENU_TRIGGER_CLASS,
  MEDIA_LIST_ROW_TITLE_CLASS,
} from "./media-list-row-constants"
import { NewBadge } from "./new-badge"
import { PlayableExpiryBadge } from "./playable-expiry-badge"
import {
  HYBRID_GROUP_ARTWORK_SIZES,
  HYBRID_GROUP_CONTENT_CLASS,
  HYBRID_GROUP_EPISODE_STILL_SLOT_CLASS,
  HYBRID_GROUP_HEADER_CLASS,
} from "./save-list-layout-constants"
import {
  FolderTitleDisplayToggleButton,
  SaveListBackButton,
} from "./save-list-header-controls"
import { useFolderTitleDisplay } from "./use-folder-title-display"

interface HybridGroupItemRowProps {
  readonly item: LinkListItem
  readonly actions: LinkItemActions
  readonly isExtracting: boolean
  readonly currentTimeMs: number
  readonly onOpenItem: (itemUrl: string) => void
  readonly itemLabel: string
  readonly displayTitle: string
  readonly titleDisplay: FolderTitleDisplay
  readonly shouldShowEpisodeStill: boolean
}

const HybridGroupItemRow = ({
  item,
  actions,
  isExtracting,
  currentTimeMs,
  onOpenItem,
  itemLabel,
  displayTitle,
  titleDisplay,
  shouldShowEpisodeStill,
}: HybridGroupItemRowProps) => {
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
        <Spinner aria-hidden="true" className="size-6" />
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
  const episodeStill = useFinderEpisodeStill(
    itemLabel,
    undefined,
    shouldShowEpisodeStill
  )
  const { artwork } = episodeStill
  const episodeTitle = artwork?.episodeTitle
  const rowDisplayTitle =
    titleDisplay === "episode"
      ? getMediaEpisodeDisplayTitle(itemLabel, episodeTitle)
      : displayTitle
  const shouldShowNewBadge =
    !isDirectLinkExpired && !isExtractionVisual && interactionState.isNew

  const handleActivate = () => {
    if (isExtractionVisual) {
      return
    }
    if (directLink) {
      void actions
        .play(directLink)
        .then((result) =>
          markAfterAcceptedHandoff({
            ...result,
            itemLabel: directLink.label,
            markOpened: () => {
              if (directLinkTarget !== undefined) {
                actions.markOpened(item.url, directLinkTarget)
              }
            },
          })
        )
        .catch(console.error)
      return
    }
    actions.markOpened(item.url, item.url)
    onOpenItem(item.url)
  }

  return (
    <MediaListRow
      label={rowDisplayTitle}
      icon={
        shouldShowEpisodeStill ? (
          <span className={HYBRID_GROUP_EPISODE_STILL_SLOT_CLASS}>
            <FinderEpisodeStillDisplay
              label={itemLabel}
              fallbackIcon={rowFallbackIcon}
              isResolving={isExtractionVisual}
              isDimmed={isDirectLinkExpired}
              isWatched={directLink?.opened === true}
              imagePath={episodeStill.imagePath}
              imageType={episodeStill.imageType}
              isLookupPending={episodeStill.isLookupPending}
            />
          </span>
        ) : (
          rowFallbackIcon
        )
      }
      title={
        <SaveExtractionStatus item={item} isRefreshing={isExtracting} isTitle>
          <FilenameText
            value={rowDisplayTitle}
            className={MEDIA_LIST_ROW_TITLE_CLASS}
            textClassName={isDirectLinkExpired ? "line-through" : undefined}
          />
        </SaveExtractionStatus>
      }
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
          {shouldShowNewBadge && <NewBadge className="md:hidden" />}
        </>
      }
      trailing={
        shouldShowNewBadge ? (
          <NewBadge className="hidden md:inline-flex" />
        ) : undefined
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
      shouldStackIconOnMobile={shouldShowEpisodeStill}
    />
  )
}

interface HybridGroupBrowserProps {
  readonly group: HybridCardGroup
  readonly actions: LinkItemActions
  readonly extractingItems: Set<string>
  readonly currentTimeMs?: number
  readonly onExit: () => void
  readonly onOpenItem: (itemUrl: string) => void
}

interface HybridGroupArtworkProps {
  readonly displayTitle: string
  readonly imagePath: string | undefined
  readonly imageType: "poster" | "still"
  readonly isArtworkPending: boolean
}

const HybridGroupArtwork = ({
  displayTitle,
  imagePath,
  imageType,
  isArtworkPending,
}: HybridGroupArtworkProps) => {
  if (imagePath) {
    return (
      <TmdbImage
        path={imagePath}
        variant="card"
        imageType={imageType}
        sizes={HYBRID_GROUP_ARTWORK_SIZES}
        alt={`Artwork for ${displayTitle}`}
        width={342}
        height={513}
      />
    )
  }

  if (isArtworkPending) {
    return (
      <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/15">
        <Spinner
          aria-label={`Loading artwork for ${displayTitle}…`}
          className="size-8"
        />
      </div>
    )
  }

  return (
    <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/15 text-sm text-muted-foreground">
      No poster found
    </div>
  )
}

export const HybridGroupBrowser = ({
  group,
  actions,
  extractingItems,
  currentTimeMs = Date.now(),
  onExit,
  onOpenItem,
}: HybridGroupBrowserProps) => {
  const [titleDisplay, toggleTitleDisplay] = useFolderTitleDisplay("episode")
  const itemLabels = useMemo(
    () => group.items.map((item) => getHybridItemLabel(item)),
    [group.items]
  )
  const shouldShowEpisodeStills =
    group.artworkRequest?.mediaKind === "tv" &&
    itemLabels.length > 0 &&
    itemLabels.every((itemLabel) => hasEpisodeMarker(itemLabel))
  const groupTitleDisplay = shouldShowEpisodeStills ? titleDisplay : "filename"
  const sortedItemEntries = useMemo(() => {
    const itemEntries = group.items.map((item, itemIndex) => ({
      item,
      itemLabel: itemLabels[itemIndex],
      originalIndex: itemIndex,
    }))
    if (!shouldShowEpisodeStills) {
      return itemEntries
    }
    return itemEntries.toSorted(
      (firstEntry, secondEntry) =>
        (parseMediaFilename(firstEntry.itemLabel).episodeNumber ??
          firstEntry.originalIndex) -
        (parseMediaFilename(secondEntry.itemLabel).episodeNumber ??
          secondEntry.originalIndex)
    )
  }, [group.items, itemLabels, shouldShowEpisodeStills])
  const artwork = useMediaArtwork(group.artworkRequest)
  const imagePath = artwork?.stillPath ?? artwork?.posterPath
  const imageType = artwork?.stillPath ? "still" : "poster"
  const isArtworkPending =
    group.artworkRequest !== undefined && artwork === undefined

  return (
    <section className="flex h-svh flex-col overflow-hidden bg-background">
      <header className={HYBRID_GROUP_HEADER_CLASS}>
        <SaveListBackButton onExit={onExit} />
        <div className="min-w-0 md:flex md:w-full md:items-center md:px-4 md:py-3">
          <h1
            aria-label={group.displayTitle}
            className="hidden w-full min-w-0 text-base font-normal md:block"
          >
            <FilenameText
              value={group.displayTitle}
              clampClassName="line-clamp-1"
              className="w-full"
            />
          </h1>
        </div>
        {shouldShowEpisodeStills ? (
          <div className="flex items-center justify-center px-1 md:px-0">
            <FolderTitleDisplayToggleButton
              titleDisplay={titleDisplay}
              onToggle={toggleTitleDisplay}
            />
          </div>
        ) : null}
      </header>
      <div className={HYBRID_GROUP_CONTENT_CLASS}>
        <div className="border-b p-4 md:block md:border-b-0 md:border-r md:p-6">
          <div className="mx-auto w-full max-w-72 md:mx-0 md:w-full md:max-w-none">
            <div className="save-list-group-artwork-frame relative overflow-hidden rounded-2xl border border-foreground/15 bg-muted">
              <HybridGroupArtwork
                displayTitle={group.displayTitle}
                imagePath={imagePath}
                imageType={imageType}
                isArtworkPending={isArtworkPending}
              />
            </div>
            {artwork?.identity ? (
              <p className="pt-1 text-center text-xs text-muted-foreground">
                Artwork: {artwork.identity.title}
                {artwork.identity.year !== undefined
                  ? ` (${artwork.identity.year})`
                  : ""}
              </p>
            ) : null}
          </div>
        </div>
        <div className="min-h-0 md:overflow-x-hidden md:overflow-y-auto md:overscroll-x-none md:overscroll-y-contain">
          <div className="stagger-children flex flex-col divide-y divide-border/70">
            {sortedItemEntries.map(({ item, itemLabel }) => (
              <HybridGroupItemRow
                key={item.id ?? item.url}
                item={item}
                actions={actions}
                isExtracting={extractingItems.has(item.url)}
                currentTimeMs={currentTimeMs}
                onOpenItem={onOpenItem}
                itemLabel={itemLabel}
                displayTitle={
                  groupTitleDisplay === "episode"
                    ? (getMediaDisplayTitle(itemLabel) ?? itemLabel)
                    : itemLabel
                }
                titleDisplay={groupTitleDisplay}
                shouldShowEpisodeStill={shouldShowEpisodeStills}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

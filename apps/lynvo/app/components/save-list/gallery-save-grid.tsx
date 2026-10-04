import {
  AlertCircleIcon,
  Delete02Icon,
  Folder01Icon,
  SourceCodeSquareIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import React from "react"

import { ChangeArtworkDialog } from "~/components/links/change-artwork-dialog"
import { LinkDebugLogDialog } from "~/components/links/link-debug-log-dialog"
import { LinkItemMenu } from "~/components/links/link-item-menu"
import { Button } from "~/components/ui/button"
import { linkCopy } from "~/features/links/link-copy"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { getLinkViewItemExtractedLinks } from "~/features/links/link-metadata-accessors"
import {
  getGalleryGroupSections,
  type GalleryGroup,
  useMediaArtwork,
} from "~/features/links/media-artwork"
import { getSavedLinkInteractionState } from "~/features/links/saved-link-interaction"
import { TmdbImage } from "~/features/links/tmdb-image"
import type {
  ExtractedLink,
  LinkExtractionStatus,
  LinkListItem,
} from "~/features/links/types"
import { useShouldAutoSaveAllLinks } from "~/features/site/settings/auto-save-links-preference"
import { useLongPress } from "~/hooks/use-long-press"
import { useCurrentTimeMs } from "~/lib/use-coarse-time-bucket"
import { cn } from "~/lib/utils"

import { ExtractionStatusTitle } from "./extraction-status"
import {
  getExtractionStatusLabel,
  getExtractionStatusInput,
  getExtractionStatusInputForState,
  getExtractionStatusTitleSpec,
  getItemExtractionState,
  type ExtractionStatusTitleSpec,
} from "./extraction-status-utils"
import { PlayableExpiryBadge } from "./playable-expiry-badge"
import {
  SAVE_LIST_SECTION_STACK_CLASS,
  SaveDateGroupSection,
} from "./save-date-group-heading"
import { getItemTitle } from "./save-list-browser-model"
import { SAVE_LIST_FEEDBACK_RING_CLASSES } from "./save-list-feedback-ring-classes"
import {
  GALLERY_GRID_CLASS,
  GALLERY_IMAGE_SIZES,
} from "./save-list-layout-constants"
import { TVBRO_FILTER_FREE_ENTER_CLASS } from "./save-list-motion-constants"
import {
  SaveListCardSkeleton,
  SaveListEmptyState,
  SaveListLoadingState,
} from "./save-list-state"

const GALLERY_MENU_TRIGGER_CLASS =
  "size-10 rounded-full bg-background/80 shadow-none hover:bg-background/80 aria-expanded:bg-background/80 dark:hover:bg-background/80"

interface GallerySaveItemProps {
  readonly group: GalleryGroup
  readonly actions: LinkItemActions
  readonly extractingItems: Set<string>
  readonly isHighlighted: boolean
  readonly currentTimeMs: number
  readonly onOpenItem: (itemUrl: string) => void
  readonly onOpenGroup: (groupKey: string) => void
}

interface GallerySaveItemArtworkProps {
  readonly displayTitle: string
  readonly imagePath: string | undefined
  readonly imageType: "poster" | "still"
  readonly isArtworkPending: boolean
  readonly isExtractionVisual: boolean
  readonly isExtractionFailed: boolean
  readonly isFolderContainer: boolean
  readonly onDelete: () => void
  readonly onOpenLog: () => void
  readonly onChooseArtwork?: () => void
}

const GallerySaveItemArtwork = ({
  displayTitle,
  imagePath,
  imageType,
  isArtworkPending,
  isExtractionVisual,
  isExtractionFailed,
  isFolderContainer,
  onDelete,
  onOpenLog,
  onChooseArtwork,
}: GallerySaveItemArtworkProps) => {
  if (isExtractionVisual) {
    if (!isExtractionFailed) {
      return (
        <SaveListCardSkeleton label={`Loading links for ${displayTitle}…`} />
      )
    }

    return (
      <div className="flex size-full flex-col items-center justify-center gap-3 bg-muted p-4">
        <HugeiconsIcon
          icon={AlertCircleIcon}
          aria-label="Extraction failed"
          className="size-8 text-muted-foreground"
        />
        <div className="z-10 flex flex-col items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onDelete}>
            <HugeiconsIcon icon={Delete02Icon} />
            Delete
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onOpenLog}>
            <HugeiconsIcon icon={SourceCodeSquareIcon} />
            {linkCopy.actions.viewLog}
          </Button>
        </div>
      </div>
    )
  }

  if (imagePath) {
    return (
      <TmdbImage
        path={imagePath}
        variant="card"
        imageType={imageType}
        sizes={GALLERY_IMAGE_SIZES}
        alt={`Artwork for ${displayTitle}`}
        width={342}
        height={513}
      />
    )
  }

  if (isArtworkPending) {
    return (
      <SaveListCardSkeleton label={`Loading artwork for ${displayTitle}…`} />
    )
  }

  if (isFolderContainer) {
    return (
      <div className="flex size-full items-center justify-center bg-muted">
        <HugeiconsIcon
          icon={Folder01Icon}
          aria-hidden="true"
          className="size-16 text-muted-foreground"
        />
      </div>
    )
  }

  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 bg-muted p-4 text-center text-sm text-muted-foreground">
      <span>No poster found</span>
      {onChooseArtwork ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="relative z-10"
          onClick={(event) => {
            event.stopPropagation()
            onChooseArtwork()
          }}
        >
          {linkCopy.actions.changeArtwork}
        </Button>
      ) : null}
    </div>
  )
}

interface GallerySingleItemState {
  readonly item: LinkListItem | undefined
  readonly isSingleItem: boolean
  readonly directLink: ExtractedLink | undefined
  readonly isDirectLinkExpired: boolean
  readonly extractionState: LinkExtractionStatus["state"]
  readonly isExtracting: boolean
  readonly isExtractionVisual: boolean
  readonly isFolderContainer: boolean
  readonly statusSpec: ExtractionStatusTitleSpec
}

const getGallerySingleItemState = (
  group: GalleryGroup,
  extractingItems: Set<string>,
  currentTimeMs: number
): GallerySingleItemState => {
  const [item] = group.items
  const isSingleItem = group.items.length === 1 && item !== undefined
  const interactionState = isSingleItem
    ? getSavedLinkInteractionState(item, currentTimeMs)
    : undefined
  const directLink = interactionState?.directLink
  const isExtracting =
    isSingleItem && item ? extractingItems.has(item.url) : false
  // Group cards answer for every member: a queued or refreshing member
  // must not render the group idle, and a failed member must be visible
  // without opening the group. Pending wins over failed so in-progress
  // retries do not flash the failure state.
  const getMemberExtractionState = (member: LinkListItem) =>
    getItemExtractionState(member, extractingItems.has(member.url))
  const pendingMember = group.items.find((member) => {
    const memberState = getMemberExtractionState(member)
    return memberState === "queued" || memberState === "running"
  })
  const failedMember = group.items.find(
    (member) => getMemberExtractionState(member) === "failed"
  )
  const extractionState: LinkExtractionStatus["state"] = getItemExtractionState(
    pendingMember ?? failedMember,
    pendingMember !== undefined
  )
  const statusSpec: ExtractionStatusTitleSpec = isSingleItem
    ? getExtractionStatusTitleSpec(item, isExtracting)
    : {
        status: getExtractionStatusInputForState(extractionState),
        fallbackLabel: pendingMember
          ? getExtractionStatusLabel(
              pendingMember,
              extractingItems.has(pendingMember.url)
            )
          : undefined,
        // The title component falls back to its own "Unable to load links"
        // default when the member recorded no error text.
        error: failedMember?.extractionStatus?.error,
      }
  return {
    item,
    isSingleItem,
    directLink,
    isDirectLinkExpired: interactionState?.isDirectLinkExpired ?? false,
    extractionState,
    isExtracting,
    isExtractionVisual:
      getExtractionStatusInput(
        isSingleItem ? item : undefined,
        isExtracting
      ) !== "idle",
    isFolderContainer:
      isSingleItem &&
      item !== undefined &&
      directLink === undefined &&
      getLinkViewItemExtractedLinks(item).length > 0,
    statusSpec,
  }
}

const GallerySaveItem = ({
  group,
  actions,
  extractingItems,
  isHighlighted,
  currentTimeMs,
  onOpenItem,
  onOpenGroup,
}: GallerySaveItemProps) => {
  const {
    item,
    isSingleItem,
    directLink,
    isDirectLinkExpired,
    extractionState,
    isExtracting,
    isExtractionVisual,
    isFolderContainer,
    statusSpec,
  } = getGallerySingleItemState(group, extractingItems, currentTimeMs)
  const artwork = useMediaArtwork(group.artworkRequest)
  const imagePath = artwork?.stillPath ?? artwork?.posterPath
  const imageType = artwork?.stillPath ? "still" : "poster"
  const isArtworkPending =
    group.artworkRequest !== undefined && artwork === undefined
  const isExtractionFailed = extractionState === "failed"
  const [isLogDialogOpen, setIsLogDialogOpen] = React.useState(false)
  const [isArtworkDialogOpen, setIsArtworkDialogOpen] = React.useState(false)
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)
  const shouldAutoSaveAllLinks = useShouldAutoSaveAllLinks()
  // Once a manual selection is confirmed, the card stops offering the
  // choice; the item menu's "Refresh link choices" reopens it.
  const shouldOfferLinkChoice =
    !shouldAutoSaveAllLinks &&
    isSingleItem &&
    item !== undefined &&
    !isExtractionVisual &&
    !item.metadata.extraction.selectionFinalized &&
    (item.metadata?.extraction?.extractedLinks?.length ?? 0) > 1
  const { longPressHandlers, consumeLongPress } = useLongPress({
    enabled: Boolean(isSingleItem && item && !isExtractionVisual),
    onLongPress: () => setIsMenuOpen(true),
  })

  const handleActivate = () => {
    if (consumeLongPress()) {
      return
    }
    if (!isSingleItem || directLink) {
      onOpenGroup(group.key)
      return
    }
    if (!item || isExtractionVisual) {
      return
    }
    actions.markOpened(item.url, item.url)
    onOpenItem(item.url)
  }

  return (
    <article
      data-testid="gallery-save-item"
      data-highlighted={isHighlighted ? true : undefined}
      data-extraction-state={extractionState}
      className={cn(
        "group relative w-full",
        TVBRO_FILTER_FREE_ENTER_CLASS,
        "animate-[enter_500ms_ease_both] fade-in slide-in-from-bottom-4 zoom-in-95 motion-reduce:animate-none"
      )}
    >
      {isExtractionVisual ? null : (
        // z-1 is load-bearing: without it the button paints under the
        // positioned card box below and its inset focus ring disappears.
        <button
          type="button"
          onClick={handleActivate}
          {...longPressHandlers}
          className="absolute inset-0 z-1 cursor-pointer rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:rounded-3xl"
          aria-label={
            isSingleItem && item && !directLink
              ? `View ${getItemTitle(item)}`
              : `Open ${group.displayTitle}`
          }
        />
      )}
      <div
        className={cn(
          "relative aspect-2/3 overflow-hidden rounded-2xl border border-foreground/15 bg-muted shadow-depth-m transition-colors duration-150 motion-reduce:transition-none sm:rounded-3xl",
          "group-hover:border-foreground/25 group-has-[:focus-visible]:border-foreground/25 has-aria-expanded:border-foreground/25",
          SAVE_LIST_FEEDBACK_RING_CLASSES.gallery.highlighted,
          SAVE_LIST_FEEDBACK_RING_CLASSES.gallery.failed,
          isDirectLinkExpired && isSingleItem && "opacity-60"
        )}
      >
        <GallerySaveItemArtwork
          displayTitle={group.displayTitle}
          imagePath={imagePath}
          imageType={imageType}
          isArtworkPending={isArtworkPending}
          isExtractionVisual={isExtractionVisual}
          isExtractionFailed={isExtractionFailed}
          isFolderContainer={isFolderContainer}
          onDelete={() => {
            if (item) {
              actions.remove(item.url, item.id)
            }
          }}
          onOpenLog={() => setIsLogDialogOpen(true)}
          onChooseArtwork={
            item && actions.setArtwork
              ? () => setIsArtworkDialogOpen(true)
              : undefined
          }
        />
        {/* The press is a black step over artwork; the shared press tint is
            tuned for plain surfaces and would wash out the poster. */}
        <div className="pointer-events-none absolute inset-0 bg-black/0 shadow-depth-gloss transition-colors duration-150 group-hover:bg-black/20 group-active:bg-black/30 group-has-[:focus-visible]:bg-black/20 group-has-aria-expanded:bg-black/20 motion-reduce:transition-none" />
        {shouldOfferLinkChoice && item && actions.chooseLinks && (
          <Button
            type="button"
            variant="ghost"
            aria-label={`Choose links for ${group.displayTitle}`}
            className="absolute bottom-4 left-1/2 z-10 h-10 -translate-x-1/2 rounded-full bg-background/80 px-3 text-xs shadow-none hover:bg-background/80 aria-expanded:bg-background/80 sm:left-4 sm:translate-x-0 dark:hover:bg-background/80"
            onClick={(event) => {
              event.stopPropagation()
              actions.chooseLinks?.(item)
            }}
          >
            Choose links
          </Button>
        )}
        {isSingleItem && item && (
          <div className="absolute right-4 bottom-4 z-10 opacity-0 transition-opacity duration-150 has-[:focus-visible]:opacity-100 focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100 has-aria-expanded:opacity-100 [@media(hover:none)]:opacity-100 motion-reduce:transition-none [&_svg]:size-7!">
            <LinkItemMenu
              item={item}
              actions={actions}
              playableLink={directLink}
              isPlayableLinkExpired={isDirectLinkExpired}
              showRemove
              isRefreshing={isExtracting}
              triggerClassName={GALLERY_MENU_TRIGGER_CLASS}
              menuOpen={isMenuOpen}
              onMenuOpenChange={setIsMenuOpen}
            />
          </div>
        )}
      </div>
      <div className="px-1 pt-3 text-center">
        <ExtractionStatusTitle
          {...statusSpec}
          titleClassName="font-heading text-base font-normal"
        >
          <h3
            className={cn(
              "font-heading text-base font-normal break-words",
              isDirectLinkExpired && "line-through"
            )}
          >
            {group.displayTitle}
          </h3>
          {isSingleItem && directLink?.expiry !== undefined && (
            <span className="mt-1 flex justify-center text-xs text-muted-foreground">
              <PlayableExpiryBadge
                expiresAt={directLink.expiry}
                expirySource={directLink.expirySource}
              />
            </span>
          )}
        </ExtractionStatusTitle>
      </div>
      <LinkDebugLogDialog
        item={item}
        open={isLogDialogOpen}
        onOpenChange={setIsLogDialogOpen}
      />
      <ChangeArtworkDialog
        item={item}
        open={isArtworkDialogOpen}
        onOpenChange={setIsArtworkDialogOpen}
        setArtwork={actions.setArtwork}
      />
    </article>
  )
}

interface GallerySaveGridProps {
  readonly groups: readonly GalleryGroup[]
  readonly actions: LinkItemActions
  readonly extractingItems: Set<string>
  readonly isHydrating: boolean
  readonly highlightedId: string | null
  readonly currentTimeMs?: number
  readonly onOpenItem: (itemUrl: string) => void
  readonly onOpenGroup: (groupKey: string) => void
}

export const GallerySaveGrid = ({
  groups,
  actions,
  extractingItems,
  isHydrating,
  highlightedId,
  currentTimeMs: currentTimeMsInput,
  onOpenItem,
  onOpenGroup,
}: GallerySaveGridProps) => {
  const currentTimeMs = useCurrentTimeMs(currentTimeMsInput)
  if (isHydrating) {
    return (
      <SaveListLoadingState label="Loading saved links…" variant="gallery" />
    )
  }
  if (groups.length === 0) {
    return <SaveListEmptyState />
  }

  const groupedSections = getGalleryGroupSections(groups, currentTimeMs)

  return (
    <div className={SAVE_LIST_SECTION_STACK_CLASS}>
      {groupedSections.map((section) => (
        <SaveDateGroupSection key={section.key} label={section.label}>
          <div className={GALLERY_GRID_CLASS}>
            {section.groups.map((group) => (
              <GallerySaveItem
                key={group.key}
                group={group}
                actions={actions}
                extractingItems={extractingItems}
                isHighlighted={group.items.some(
                  (item) => item.id === highlightedId
                )}
                currentTimeMs={currentTimeMs}
                onOpenItem={onOpenItem}
                onOpenGroup={onOpenGroup}
              />
            ))}
          </div>
        </SaveDateGroupSection>
      ))}
    </div>
  )
}

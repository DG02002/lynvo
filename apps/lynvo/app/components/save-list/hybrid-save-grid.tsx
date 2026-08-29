import React from "react"
import { LinkItemMenu } from "~/components/links/link-item-menu"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  Delete02Icon,
  SourceCodeSquareIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "~/components/ui/button"
import { LinkDebugLogDialog } from "~/components/links/link-debug-log-dialog"
import { useShouldAutoSaveAllLinks } from "~/features/site/settings/auto-save-links-preference"
import { Spinner } from "~/components/spinner"
import { TmdbImage } from "~/features/links/components/tmdb-image"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { getHybridCardGroupSections } from "~/features/links/media-artwork/hybrid-card-grouping"
import { useMediaArtwork } from "~/features/links/media-artwork/use-media-artwork"
import { getSavedLinkInteractionState } from "~/features/links/saved-link-interaction"
import { cn } from "~/lib/utils"
import { useLongPress } from "~/hooks/use-long-press"
import {
  SaveExtractionStatus,
  getExtractionStatusInput,
} from "./extraction-status"
import { PlayableExpiryBadge } from "./playable-expiry-badge"
import { getItemTitle } from "./save-list-browser-model"
import {
  SAVE_LIST_SECTION_STACK_CLASS,
  SaveDateGroupSection,
} from "./save-date-group-heading"
import { SaveListEmptyState, SaveListLoadingState } from "./save-list-state"

const HYBRID_CARD_GRID_CLASS =
  "stagger-children grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-6"

const HYBRID_CARD_MENU_TRIGGER_CLASS =
  "size-10 rounded-full bg-background/80 shadow-none hover:bg-background/80 aria-expanded:bg-background/80 dark:hover:bg-background/80"

interface HybridSaveCardProps {
  readonly group: HybridCardGroup
  readonly actions: LinkItemActions
  readonly extractingItems: Set<string>
  readonly isHighlighted: boolean
  readonly currentTimeMs: number
  readonly onOpenItem: (itemUrl: string) => void
  readonly onOpenGroup: (groupKey: string) => void
}

const HybridSaveCard = ({
  group,
  actions,
  extractingItems,
  isHighlighted,
  currentTimeMs,
  onOpenItem,
  onOpenGroup,
}: HybridSaveCardProps) => {
  const item = group.items[0]
  const isSingleItem = group.items.length === 1 && item !== undefined
  const interactionState = isSingleItem
    ? getSavedLinkInteractionState(item, currentTimeMs)
    : undefined
  const directLink = interactionState?.directLink
  const isDirectLinkExpired = interactionState?.isDirectLinkExpired ?? false
  const extractionState = isSingleItem
    ? (item?.extractionStatus?.state ?? "complete")
    : "complete"
  const isExtracting =
    isSingleItem && item ? extractingItems.has(item.url) : false
  const isExtractionVisual =
    getExtractionStatusInput(item, isExtracting) !== "idle"
  const artwork = useMediaArtwork(group.artworkRequest)
  const imagePath = artwork?.stillPath ?? artwork?.posterPath
  const isArtworkPending =
    group.artworkRequest !== undefined && artwork === undefined
  const isExtractionFailed = extractionState === "failed"
  const [isLogDialogOpen, setIsLogDialogOpen] = React.useState(false)
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)
  const shouldAutoSaveAllLinks = useShouldAutoSaveAllLinks()
  const shouldOfferLinkChoice =
    !shouldAutoSaveAllLinks &&
    isSingleItem &&
    item !== undefined &&
    !isExtractionVisual &&
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
      data-testid="hybrid-save-card"
      data-highlighted={isHighlighted ? true : undefined}
      data-extraction-state={extractionState}
      className="group relative w-full animate-in fade-in fill-mode-both slide-in-from-bottom-4 zoom-in-95 duration-500 motion-reduce:animate-none"
    >
      {isExtractionVisual ? null : (
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
          "relative aspect-2/3 overflow-hidden rounded-2xl border border-foreground/15 bg-muted transition-colors duration-150 motion-reduce:transition-none sm:rounded-3xl",
          "group-hover:border-foreground/25 group-has-[:focus-visible]:border-foreground/25 has-aria-expanded:border-foreground/25",
          isDirectLinkExpired && isSingleItem && "opacity-60"
        )}
      >
        {isExtractionVisual ? (
          <div className="flex size-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted to-muted-foreground/15 p-4">
            {isExtractionFailed ? (
              <>
                <HugeiconsIcon
                  icon={AlertCircleIcon}
                  aria-label="Extraction failed"
                  className="size-8 text-muted-foreground"
                />
                <div className="z-10 flex flex-col items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (item) {
                        actions.remove(item.url, item.id)
                      }
                    }}
                  >
                    <HugeiconsIcon icon={Delete02Icon} />
                    Delete
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsLogDialogOpen(true)}
                  >
                    <HugeiconsIcon icon={SourceCodeSquareIcon} />
                    Log
                  </Button>
                </div>
              </>
            ) : (
              <Spinner aria-hidden="true" className="size-8" />
            )}
          </div>
        ) : imagePath ? (
          <TmdbImage
            path={imagePath}
            variant="card"
            imageType={artwork?.stillPath ? "still" : "poster"}
            sizes="(min-width: 768px) 14vw, (min-width: 640px) 28vw, 45vw"
            alt={`Artwork for ${group.displayTitle}`}
            width={342}
            height={513}
          />
        ) : isArtworkPending ? (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/15">
            <Spinner
              aria-label={`Loading artwork for ${group.displayTitle}…`}
              className="size-8"
            />
          </div>
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/15 text-sm text-muted-foreground">
            No poster found
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-150 group-hover:bg-black/20 group-has-[:focus-visible]:bg-black/20 group-has-aria-expanded:bg-black/20 motion-reduce:transition-none" />
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
          <div className="invisible pointer-events-none absolute right-4 bottom-4 z-10 opacity-0 transition-opacity duration-150 sm:visible sm:pointer-events-auto sm:group-hover:opacity-100 sm:has-[:focus-visible]:opacity-100 sm:has-aria-expanded:opacity-100 [@media(hover:none)]:sm:opacity-100 motion-reduce:transition-none [&_svg]:size-7!">
            <LinkItemMenu
              item={item}
              actions={actions}
              playableLink={directLink}
              isPlayableLinkExpired={isDirectLinkExpired}
              showRemove
              isRefreshing={isExtracting}
              triggerClassName={HYBRID_CARD_MENU_TRIGGER_CLASS}
              menuOpen={isMenuOpen}
              onMenuOpenChange={setIsMenuOpen}
            />
          </div>
        )}
      </div>
      <div className="px-1 pt-3 text-center">
        {isSingleItem && item ? (
          <SaveExtractionStatus
            item={item}
            isRefreshing={isExtracting}
            isTitle
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
            {directLink?.expiry !== undefined && (
              <span className="mt-1 flex justify-center text-xs text-muted-foreground">
                <PlayableExpiryBadge
                  expiresAt={directLink.expiry}
                  expirySource={directLink.expirySource}
                />
              </span>
            )}
          </SaveExtractionStatus>
        ) : (
          <h3 className="font-heading text-base font-normal break-words">
            {group.displayTitle}
          </h3>
        )}
      </div>
      <LinkDebugLogDialog
        item={item}
        open={isLogDialogOpen}
        onOpenChange={setIsLogDialogOpen}
      />
    </article>
  )
}

interface HybridSaveGridProps {
  readonly groups: readonly HybridCardGroup[]
  readonly actions: LinkItemActions
  readonly extractingItems: Set<string>
  readonly isHydrating: boolean
  readonly highlightedId: string | null
  readonly currentTimeMs?: number
  readonly onOpenItem: (itemUrl: string) => void
  readonly onOpenGroup: (groupKey: string) => void
}

export const HybridSaveGrid = ({
  groups,
  actions,
  extractingItems,
  isHydrating,
  highlightedId,
  currentTimeMs = Date.now(),
  onOpenItem,
  onOpenGroup,
}: HybridSaveGridProps) => {
  if (isHydrating) {
    return <SaveListLoadingState label="Loading saved links…" />
  }
  if (groups.length === 0) {
    return <SaveListEmptyState />
  }

  const groupedSections = getHybridCardGroupSections(groups, currentTimeMs)

  return (
    <div className={SAVE_LIST_SECTION_STACK_CLASS}>
      {groupedSections.map((section) => (
        <SaveDateGroupSection key={section.key} label={section.label}>
          <div className={HYBRID_CARD_GRID_CLASS}>
            {section.groups.map((group) => (
              <HybridSaveCard
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

import { LinkItemMenu } from "~/components/links/link-item-menu"
import { Spinner } from "~/components/spinner"
import { TmdbImage } from "~/features/links/components/tmdb-image"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { getMediaNodeTargetOrUndefined } from "~/features/links/media-node-interaction"
import {
  getHybridCardGroupSections,
  getHybridItemLabel,
} from "~/features/links/media-artwork/hybrid-card-grouping"
import { useMediaArtwork } from "~/features/links/media-artwork/use-media-artwork"
import { getSavedLinkInteractionState } from "~/features/links/saved-link-interaction"
import { markAfterAcceptedHandoff } from "~/lib/opened-confirmation-events"
import { cn } from "~/lib/utils"
import { SaveExtractionStatus } from "./extraction-status"
import { NewBadge } from "./new-badge"
import { PlayableExpiryBadge } from "./playable-expiry-badge"
import { getItemTitle } from "./save-list-browser-model"
import {
  SAVE_LIST_SECTION_STACK_CLASS,
  SaveDateGroupSection,
} from "./save-date-group-heading"
import { SaveListEmptyState, SaveListLoadingState } from "./save-list-state"

const HYBRID_CARD_GRID_CLASS =
  "stagger-children grid grid-cols-3 gap-x-4 gap-y-6 md:grid-cols-6"

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
  const isExtractionIncomplete = extractionState !== "complete"
  const isExtracting =
    isSingleItem && item ? extractingItems.has(item.url) : false
  const isNew =
    isSingleItem &&
    !isExtractionIncomplete &&
    (interactionState?.isNew ?? false)
  const isMovieGroup = group.artworkRequest?.mediaKind === "movie"
  const shouldShowRealName = isSingleItem && isMovieGroup
  const realItemLabel =
    shouldShowRealName && item ? getHybridItemLabel(item) : undefined
  const artwork = useMediaArtwork(group.artworkRequest)
  const imagePath = artwork?.stillPath ?? artwork?.posterPath
  const directLinkTarget = directLink
    ? getMediaNodeTargetOrUndefined(directLink)
    : undefined

  const handleDirectPlay = async () => {
    if (!directLink || isDirectLinkExpired) {
      return
    }
    try {
      const result = await actions.play(directLink)
      markAfterAcceptedHandoff({
        ...result,
        itemLabel: directLink.label,
        markOpened: () => {
          if (directLinkTarget !== undefined) {
            actions.markOpened(item.url, directLinkTarget)
          }
        },
      })
    } catch (error) {
      console.error(error)
    }
  }

  const handleActivate = () => {
    if (!isSingleItem) {
      onOpenGroup(group.key)
      return
    }
    if (!item || isExtractionIncomplete || directLink) {
      return
    }
    actions.markOpened(item.url, item.url)
    onOpenItem(item.url)
  }

  return (
    <article
      data-testid="hybrid-save-card"
      data-layout-guide-target="library-card"
      data-highlighted={isHighlighted ? true : undefined}
      data-extraction-state={extractionState}
      className="group relative w-full animate-in fade-in fill-mode-both slide-in-from-bottom-4 zoom-in-95 duration-500 motion-reduce:animate-none"
    >
      {isExtractionIncomplete ? null : isSingleItem && directLink ? (
        <button
          type="button"
          disabled={isDirectLinkExpired}
          onClick={() => void handleDirectPlay()}
          className="absolute inset-0 z-1 cursor-pointer rounded-3xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed"
          aria-label={`Play ${group.displayTitle}`}
        />
      ) : (
        <button
          type="button"
          onClick={handleActivate}
          className="absolute inset-0 z-1 cursor-pointer rounded-3xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          aria-label={
            isSingleItem && item
              ? `View ${getItemTitle(item)}`
              : `Open ${group.displayTitle}`
          }
        />
      )}
      <div
        className={cn(
          "relative aspect-2/3 overflow-hidden rounded-3xl border border-foreground/15 bg-muted transition-colors duration-150 motion-reduce:transition-none",
          "group-hover:border-foreground/25 group-has-[:focus-visible]:border-foreground/25 has-aria-expanded:border-foreground/25",
          isDirectLinkExpired && isSingleItem && "opacity-60"
        )}
      >
        {isExtractionIncomplete ? (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/15">
            <Spinner aria-hidden="true" className="size-8" />
          </div>
        ) : imagePath ? (
          <TmdbImage
            path={imagePath}
            variant="card"
            alt={`Artwork for ${group.displayTitle}`}
            width={342}
            height={513}
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/15 text-sm text-muted-foreground">
            No poster found
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-150 group-hover:bg-black/20 group-has-[:focus-visible]:bg-black/20 group-has-aria-expanded:bg-black/20 motion-reduce:transition-none" />
        {isNew && <NewBadge className="absolute left-3 top-3 z-10" />}
        {isSingleItem && item && (
          <div className="absolute bottom-4 right-4 z-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100 has-[:focus-visible]:opacity-100 has-aria-expanded:opacity-100 [@media(hover:none)]:opacity-100 motion-reduce:transition-none [&_svg]:size-7!">
            <LinkItemMenu
              item={item}
              actions={actions}
              playableLink={directLink}
              isPlayableLinkExpired={isDirectLinkExpired}
              showRemove
              isRefreshing={isExtracting}
              triggerClassName={HYBRID_CARD_MENU_TRIGGER_CLASS}
            />
          </div>
        )}
      </div>
      <div className="px-1 pt-3 text-center">
        {isExtractionIncomplete && isSingleItem && item ? (
          <SaveExtractionStatus
            item={item}
            isRefreshing={isExtracting}
            isTitle
          />
        ) : (
          <>
            <h3
              className={cn(
                "font-heading text-base font-normal",
                shouldShowRealName
                  ? "line-clamp-2 md:line-clamp-3"
                  : "break-words",
                isDirectLinkExpired && isSingleItem && "line-through"
              )}
            >
              {shouldShowRealName ? realItemLabel : group.displayTitle}
            </h3>
            {directLink?.expiry !== undefined && (
              <span className="mt-1 flex justify-center text-xs text-muted-foreground">
                <PlayableExpiryBadge
                  expiresAt={directLink.expiry}
                  expirySource={directLink.expirySource}
                />
              </span>
            )}
          </>
        )}
      </div>
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
        <SaveDateGroupSection
          key={section.key}
          label={section.label}
          sectionDataAttributes={{
            "data-layout": "poster-grid",
            "data-layout-guide-target": "library-section",
          }}
        >
          <div
            className={HYBRID_CARD_GRID_CLASS}
            data-layout-guide-target="library-grid"
          >
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

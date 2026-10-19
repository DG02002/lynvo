import {
  AlertCircleIcon,
  Folder01Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ExpandableFilename } from "~/components/expandable-filename"
import { LinkItemMenu } from "~/components/links/link-item-menu"
import { NewBadge } from "~/components/save-list/new-badge"
import { PlayableExpiryBadge } from "~/components/save-list/playable-expiry-badge"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { toLinkViewModel } from "~/features/links/link-view-models"
import { getMediaNodeTargetOrUndefined } from "~/features/links/media-node-interaction"
import { openInPlayerAndLogError } from "~/features/links/open-in-player"
import { getSavedLinkInteractionState } from "~/features/links/saved-link-interaction"
import type { ExtractedLink, LinkListItem } from "~/features/links/types"
import { useMinuteTimeBucket } from "~/lib/use-coarse-time-bucket"
import { cn } from "~/lib/utils"

import { ExtractionFailedActions } from "./extraction-failed-actions"
import { ExtractionStatusTitle } from "./extraction-status"
import {
  getExtractionStatusInput,
  getExtractionStatusLabel,
  getExtractionStatusTitleSpec,
  getItemExtractionState,
  isPendingExtractionState,
} from "./extraction-status-utils"
import { FinderBrowser } from "./finder-browser"
import { buildItemAriaLabel } from "./item-aria-label"
import { MediaListRowMeta, SaveListRowIcon } from "./media-list-row"
import {
  MEDIA_LIST_ROW_HOVER_TINT_CLASS,
  MEDIA_LIST_ROW_MENU_CELL_CLASS,
  MEDIA_LIST_ROW_OPENED_TINT_CLASS,
  MEDIA_LIST_ROW_TITLE_CLASS,
  SAVE_LIST_ROW_ENTER_ANIMATION_CLASS,
} from "./media-list-row-constants"
import { ResolvableContainerRow } from "./resolvable-container-row"
import {
  SAVE_LIST_SECTION_STACK_CLASS,
  SaveDateGroupSection,
} from "./save-date-group-heading"
import { getItemTitle } from "./save-list-browser-model"
import { SAVE_LIST_FEEDBACK_RING_CLASSES } from "./save-list-feedback-ring-classes"
import { groupSaveListItems } from "./save-list-groups"
import { SaveListRowPoster } from "./save-list-row-poster"
import { SaveListEmptyState, SaveListLoadingState } from "./save-list-state"

interface SaveListBrowserProps {
  items: LinkListItem[]
  selectedItemUrl: string | null
  onSelectedItemUrlChange: (url: string | null) => void
  actions: LinkItemActions
  extractingItems: Set<string>
  highlightedId: string | null
  isHydrating: boolean
  shouldShowRowPosters?: boolean
}

interface SaveListItemAriaLabelOptions {
  readonly itemTitle: string
  readonly directLink: ExtractedLink | undefined
  readonly isExtractionIncomplete: boolean
  readonly extractionStatusLabel: string
  readonly isOpened: boolean
  readonly isNew: boolean
}

const getSaveListItemAriaLabel = ({
  itemTitle,
  directLink,
  isExtractionIncomplete,
  extractionStatusLabel,
  isOpened,
  isNew,
}: SaveListItemAriaLabelOptions) => {
  let label: string

  if (isExtractionIncomplete) {
    label = `${extractionStatusLabel} for ${itemTitle}`
  } else if (directLink) {
    label = `Open ${directLink.label || itemTitle}`
  } else {
    label = `View ${itemTitle}`
  }

  return buildItemAriaLabel({ label, isOpened, isNew })
}

interface SaveListRootRowIconProps {
  readonly item: LinkListItem
  readonly isExtracting: boolean
  readonly shouldShowRowPosters: boolean
  readonly directLinkLabel: string | undefined
  readonly itemTitle: string
  readonly isDirectLinkExpired: boolean
}

interface SaveListRootRowFallbackIconProps {
  readonly isExtractionVisual: boolean
  readonly didExtractionFail: boolean
  readonly directLinkLabel: string | undefined
}

const SaveListRootRowFallbackIcon = ({
  isExtractionVisual,
  didExtractionFail,
  directLinkLabel,
}: SaveListRootRowFallbackIconProps) => {
  if (isExtractionVisual && didExtractionFail) {
    return <HugeiconsIcon icon={AlertCircleIcon} className="size-6" />
  }

  if (isExtractionVisual) {
    return (
      <span
        aria-hidden="true"
        className="loading-skeleton-pulse inline-flex text-muted-foreground"
      >
        <HugeiconsIcon icon={Folder01Icon} className="size-6" />
      </span>
    )
  }

  if (directLinkLabel) {
    return <HugeiconsIcon icon={PlayIcon} className="size-6" />
  }

  return <HugeiconsIcon icon={Folder01Icon} className="size-6" />
}

const SaveListRootRowIcon = ({
  item,
  isExtracting,
  shouldShowRowPosters,
  directLinkLabel,
  itemTitle,
  isDirectLinkExpired,
}: SaveListRootRowIconProps) => {
  const extractionInput = getExtractionStatusInput(item, isExtracting)
  const didExtractionFail = extractionInput === "failed"
  const isExtractionVisual = extractionInput !== "idle"
  const fallbackIcon = (
    <SaveListRootRowFallbackIcon
      isExtractionVisual={isExtractionVisual}
      didExtractionFail={didExtractionFail}
      directLinkLabel={directLinkLabel}
    />
  )

  if (shouldShowRowPosters) {
    return (
      <SaveListRowPoster
        label={directLinkLabel ?? itemTitle}
        isContainer={!directLinkLabel}
        fallbackIcon={fallbackIcon}
        isDimmed={isDirectLinkExpired}
      />
    )
  }
  if (directLinkLabel) {
    return (
      <SaveListRowIcon
        className={isDirectLinkExpired ? "text-muted-foreground" : undefined}
      >
        {fallbackIcon}
      </SaveListRowIcon>
    )
  }
  return <SaveListRowIcon>{fallbackIcon}</SaveListRowIcon>
}

export const SaveListBrowser = ({
  items,
  selectedItemUrl,
  onSelectedItemUrlChange,
  actions,
  extractingItems,
  highlightedId,
  isHydrating,
  shouldShowRowPosters = false,
}: SaveListBrowserProps) => {
  const minuteTimeBucket = useMinuteTimeBucket()
  const selectedItem = items.find((item) => item.url === selectedItemUrl)

  if (selectedItem?.kind === "saved") {
    return (
      <FinderBrowser
        key={selectedItem.url}
        item={selectedItem}
        actions={actions}
        extractingItems={extractingItems}
        onExit={() => onSelectedItemUrlChange(null)}
        shouldShowRowPosters={shouldShowRowPosters}
      />
    )
  }

  if (isHydrating) {
    return <SaveListLoadingState label="Loading saved links…" />
  }

  if (items.length === 0) {
    return <SaveListEmptyState />
  }

  const groupedItems = groupSaveListItems(items, minuteTimeBucket)

  return (
    <section className={SAVE_LIST_SECTION_STACK_CLASS}>
      {groupedItems.map((group) => (
        <SaveDateGroupSection key={group.key} label={group.label}>
          <div className="stagger-children flex flex-col divide-y divide-border/70">
            {group.items.map((item) => {
              const itemKey = item.id ?? item.url
              const view = toLinkViewModel(item)
              const interactionState = getSavedLinkInteractionState(
                item,
                minuteTimeBucket
              )
              const { directLink, isDirectLinkExpired, isResolvableContainer } =
                interactionState
              const isExtracting = extractingItems.has(item.url)
              const extractionState = getItemExtractionState(item, isExtracting)
              // A failed extraction keeps the previously extracted playable
              // links, so only the loading states block activation; the row
              // stays usable with its failed-status actions.
              const isExtractionIncomplete =
                isPendingExtractionState(extractionState)
              const isRootItemNew =
                !isExtractionIncomplete && interactionState.isNew

              const directLinkTarget = directLink
                ? getMediaNodeTargetOrUndefined(directLink)
                : undefined
              if (
                directLink &&
                isResolvableContainer &&
                directLinkTarget !== undefined &&
                !isExtractionIncomplete
              ) {
                return (
                  <ResolvableContainerRow
                    key={itemKey}
                    item={item}
                    link={directLink}
                    actions={actions}
                    isResolving={extractingItems.has(directLinkTarget)}
                    onRemove={() => actions.remove(item.url, item.id)}
                  />
                )
              }

              return (
                <div
                  key={itemKey}
                  className={cn(
                    "group relative flex items-stretch",
                    SAVE_LIST_ROW_ENTER_ANIMATION_CLASS,
                    SAVE_LIST_FEEDBACK_RING_CLASSES.row.highlighted,
                    SAVE_LIST_FEEDBACK_RING_CLASSES.row.failed
                  )}
                  data-highlighted={
                    highlightedId === item.id ? true : undefined
                  }
                  data-extraction-state={extractionState}
                >
                  <div className="flex min-h-20 min-w-0 flex-1 items-center gap-0 px-3 py-4 md:gap-3 md:px-4 md:py-5">
                    <button
                      type="button"
                      disabled={isExtractionIncomplete}
                      aria-label={getSaveListItemAriaLabel({
                        itemTitle: getItemTitle(item),
                        directLink,
                        isExtractionIncomplete,
                        extractionStatusLabel: getExtractionStatusLabel(
                          extractionState,
                          item.extractionStatus?.error
                        ),
                        isOpened: directLink?.opened === true,
                        isNew: isRootItemNew,
                      })}
                      className={cn(
                        "absolute inset-0 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        !isExtractionIncomplete &&
                          MEDIA_LIST_ROW_HOVER_TINT_CLASS,
                        directLink?.opened &&
                          !isExtractionIncomplete &&
                          MEDIA_LIST_ROW_OPENED_TINT_CLASS,
                        isExtractionIncomplete && "cursor-not-allowed"
                      )}
                      onClick={() => {
                        if (isExtractionIncomplete) {
                          return
                        }
                        if (directLink) {
                          openInPlayerAndLogError(
                            () => actions.play(directLink),
                            {
                              itemLabel: directLink.label,
                              markOpened: () => {
                                if (directLinkTarget !== undefined) {
                                  actions.markOpened(item.url, directLinkTarget)
                                }
                              },
                            }
                          )
                          return
                        }
                        actions.markOpened(item.url, item.url)
                        onSelectedItemUrlChange(item.url)
                      }}
                    />
                    <div
                      className={cn(
                        "pointer-events-none relative min-w-0 flex-1 items-center gap-2 text-left md:gap-3",
                        "flex",
                        isDirectLinkExpired && "text-muted-foreground",
                        isExtractionIncomplete && "text-muted-foreground"
                      )}
                    >
                      <SaveListRootRowIcon
                        item={item}
                        isExtracting={isExtracting}
                        shouldShowRowPosters={shouldShowRowPosters}
                        directLinkLabel={directLink?.label}
                        itemTitle={getItemTitle(item)}
                        isDirectLinkExpired={isDirectLinkExpired}
                      />
                      <span className="min-w-0 flex-1">
                        <ExtractionStatusTitle
                          {...getExtractionStatusTitleSpec(item, isExtracting)}
                          titleClassName={MEDIA_LIST_ROW_TITLE_CLASS}
                        >
                          <ExpandableFilename
                            value={directLink?.label || getItemTitle(item)}
                            className={MEDIA_LIST_ROW_TITLE_CLASS}
                            isInsideActivationOverlay
                          />
                          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground md:flex-nowrap">
                            <MediaListRowMeta
                              sourceName={
                                view.sourceName || view.pluginName || item.url
                              }
                              size={directLink?.size}
                              itemCount={
                                directLink
                                  ? undefined
                                  : view.extractedLinks.length
                              }
                            />
                            {directLink?.expiry !== undefined && (
                              <>
                                <span
                                  aria-hidden="true"
                                  className="hidden md:inline"
                                >
                                  ·
                                </span>
                                <PlayableExpiryBadge
                                  expiresAt={directLink.expiry}
                                />
                              </>
                            )}
                            {isRootItemNew && (
                              <NewBadge className="ms-auto md:hidden" />
                            )}
                          </span>
                        </ExtractionStatusTitle>
                        {extractionState === "failed" && (
                          <ExtractionFailedActions
                            item={item}
                            onDelete={() => actions.remove(item.url, item.id)}
                            onRetry={() => actions.hardRefresh(item.url)}
                            isRetrying={isExtracting}
                            className="mt-1.5"
                          />
                        )}
                      </span>
                      {isRootItemNew && (
                        // Stays inside the positioned content div: outside
                        // it, the static badge paints under the activation
                        // button's opaque hover tint and disappears.
                        <NewBadge className="hidden md:inline-flex" />
                      )}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "relative flex items-center justify-center",
                      MEDIA_LIST_ROW_MENU_CELL_CLASS
                    )}
                  >
                    <LinkItemMenu
                      item={item}
                      actions={actions}
                      playableLink={directLink}
                      showRemove
                      isRefreshing={isExtracting}
                      triggerLook="media-row"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </SaveDateGroupSection>
      ))}
    </section>
  )
}

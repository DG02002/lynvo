import { ExpandableFilename } from "~/components/expandable-filename"
import { LinkItemMenu } from "~/components/links/link-item-menu"
import { NewBadge } from "~/components/save-list/new-badge"
import { PlayableExpiryBadge } from "~/components/save-list/playable-expiry-badge"
import { toLinkViewModel } from "~/features/links/link-view-models"
import { getMediaNodeTargetOrUndefined } from "~/features/links/media-node-interaction"
import { getSavedLinkInteractionState } from "~/features/links/saved-link-interaction"
import type { LinkListItem } from "~/features/links/types"
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
import { useSaveListSession } from "./save-list-session"
import { SaveListEmptyState, SaveListLoadingState } from "./save-list-state"
import {
  getSaveListItemAriaLabel,
  getSaveListItemFallbackIcon,
  openPlayableAndMarkOpened,
  SaveListItemFallbackIcon,
} from "./save-list-view-model"

interface SaveListBrowserProps {
  items: LinkListItem[]
  selectedItemUrl: string | null
  onSelectedItemUrlChange: (url: string | null) => void
}

interface SaveListRootRowIconProps {
  readonly item: LinkListItem
  readonly isExtracting: boolean
  readonly shouldShowRowPosters: boolean
  readonly directLinkLabel: string | undefined
  readonly itemTitle: string
  readonly isDirectLinkExpired: boolean
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
  const fallbackIconDescriptor = getSaveListItemFallbackIcon(
    extractionInput,
    Boolean(directLinkLabel)
  )
  const fallbackIcon = (
    <SaveListItemFallbackIcon descriptor={fallbackIconDescriptor} />
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
}: SaveListBrowserProps) => {
  const {
    actions,
    extractingItems,
    highlightedId,
    isHydrating,
    shouldShowRowPosters,
  } = useSaveListSession()
  const minuteTimeBucket = useMinuteTimeBucket()
  const selectedItem = items.find((item) => item.url === selectedItemUrl)

  if (selectedItem?.kind === "saved") {
    return (
      <FinderBrowser
        key={selectedItem.url}
        item={selectedItem}
        onExit={() => onSelectedItemUrlChange(null)}
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
                          void openPlayableAndMarkOpened({
                            actions,
                            itemUrl: item.url,
                            playableLink: directLink,
                            open: () => actions.play(directLink),
                          })
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

import { useState } from "react"
import type { RefObject } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  AlertCircleIcon,
  Folder01Icon,
  Folder02Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "~/components/ui/button"
import { LinkItemMenu } from "~/components/links/link-item-menu"
import { LinkActionsDotMenu } from "~/components/links/link-actions-context-menu"
import { Spinner } from "~/components/spinner"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import type {
  ExtractedLink,
  LinkListItem,
  LinkViewItem,
} from "~/features/links/types"
import { toLinkViewModel } from "~/features/links/link-view-models"
import { openInSpecificPlayer, type PlayerDefinition } from "~/lib/player-utils"
import { cn } from "~/lib/utils"
import { PlayableExpiryBadge } from "~/components/save-list/playable-expiry-badge"
import { NewBadge } from "~/components/save-list/new-badge"
import { FilenameText } from "~/components/filename-text"
import { getSavedLinkInteractionState } from "~/features/links/saved-link-interaction"
import {
  getMediaDisplayTitle,
  hasEpisodeMarker,
} from "~/features/links/media-artwork/media-artwork-identity"
import {
  getMediaNodeInteractionState,
  getMediaNodeTargetOrUndefined,
} from "~/features/links/media-node-interaction"
import {
  getFolderIcon,
  getFolderVisualState,
  getItemTitle,
  getLinkKey,
  isMirrorResolvable,
  type FolderLevel,
} from "./save-list-browser-model"
import { useFinderBrowserState } from "./use-finder-browser-state"
import { markAfterAcceptedHandoff } from "~/lib/opened-confirmation-events"
import { groupSaveListItems } from "./save-list-groups"
import { ResolvableContainerRow } from "./resolvable-container-row"
import { FinderEpisodeStill } from "./finder-episode-still"
import { SaveListRowPoster } from "./save-list-row-poster"
import {
  MEDIA_LIST_HEADER_MENU_CELL_CLASS,
  MEDIA_LIST_ROW_MENU_CELL_CLASS,
  MEDIA_LIST_ROW_MENU_TRIGGER_CLASS,
  MEDIA_LIST_ROW_TITLE_CLASS,
  MediaListRowMeta,
  MediaListRow,
  SAVE_LIST_ROW_ENTER_ANIMATION_CLASS,
  SaveListRowIcon,
} from "./media-list-row"
import {
  SAVE_LIST_SECTION_STACK_CLASS,
  SaveDateGroupSection,
} from "./save-date-group-heading"
import {
  SaveExtractionStatus,
  getExtractionStatusLabel,
} from "./extraction-status"
import { SaveListEmptyState, SaveListLoadingState } from "./save-list-state"

interface SaveListBrowserProps {
  items: LinkListItem[]
  selectedItemUrl: string | null
  onSelectedItemUrlChange: (url: string | null) => void
  actions: LinkItemActions
  extractingItems: Set<string>
  highlightedId: string | null
  isHydrating: boolean
  currentTimeMs?: number
  shouldShowRowPosters?: boolean
}

interface FinderBrowserProps {
  item: LinkViewItem
  actions: LinkItemActions
  extractingItems: Set<string>
  onExit: () => void
  shouldShowRowPosters?: boolean
}

interface FinderEmptyStateProps {
  item: LinkViewItem
  actions: LinkItemActions
  extractingItems: Set<string>
  onExit: () => void
  contentRef: RefObject<HTMLDivElement | null>
}

interface FolderTreeProps {
  rootLabel: string
  folderPath: FolderLevel[]
  links: ExtractedLink[]
  onSelectRoot: () => void
  onSelectFolder: (link: ExtractedLink, path: FolderLevel[]) => void
}

interface MobileFolderTreeToggleProps {
  currentFolderLabel: string
  isOpen: boolean
  onToggle: () => void
}

interface FinderBackButtonProps {
  readonly onExit: () => void
}

const isVisibleTreeFolder = (link: ExtractedLink) =>
  getMediaNodeInteractionState(link).isFolder && !isMirrorResolvable(link)

const MobileFolderTreeToggle = ({
  currentFolderLabel,
  isOpen,
  onToggle,
}: MobileFolderTreeToggleProps) => (
  <Button
    variant="ghost"
    className="h-auto min-h-11 w-full justify-start gap-3 rounded-lg px-0 text-left font-normal md:hidden"
    aria-expanded={isOpen}
    aria-label={isOpen ? "Collapse folder tree" : "Expand folder tree"}
    onClick={onToggle}
  >
    <SaveListRowIcon>
      <HugeiconsIcon icon={Folder02Icon} className="size-6" />
    </SaveListRowIcon>
    <span className="min-w-0 flex-1 truncate">{currentFolderLabel}</span>
    <span className="flex size-9 shrink-0 items-center justify-center">
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        className={cn("size-4 transition-transform", isOpen && "rotate-180")}
      />
    </span>
  </Button>
)

export const FinderBackButton = ({ onExit }: FinderBackButtonProps) => (
  <div className="contents md:block md:h-full md:border-r">
    <Button
      variant="ghost"
      className="text-lg text-foreground hover:bg-transparent hover:text-foreground md:h-full md:w-full md:justify-center md:rounded-none md:px-4 md:hover:bg-muted/70"
      onClick={onExit}
    >
      <HugeiconsIcon
        icon={ArrowLeft01Icon}
        className="size-6 text-foreground"
        data-icon="inline-start"
      />
      Back
    </Button>
  </div>
)

const FolderTree = ({
  rootLabel,
  folderPath,
  links,
  onSelectRoot,
  onSelectFolder,
}: FolderTreeProps) => {
  const renderFolders = (
    folderLinks: ExtractedLink[],
    parentPath: FolderLevel[]
  ) => {
    const visibleFolderLinks = folderLinks.filter(isVisibleTreeFolder)
    const activeFolderIndex = visibleFolderLinks.findIndex((link) =>
      folderPath.some((folder) => folder.id === getLinkKey(link))
    )

    return visibleFolderLinks.map((link, index) => {
      const linkKey = getLinkKey(link)
      const path = [...parentPath, { id: linkKey, label: link.label }]
      const isCurrent = folderPath.at(-1)?.id === linkKey
      const isInPath = folderPath.some((folder) => folder.id === linkKey)
      const isLastFolder = index === visibleFolderLinks.length - 1
      const doesActiveBranchContinue = activeFolderIndex > index

      return (
        <div key={linkKey} className="relative flex min-w-0 flex-col gap-1">
          {!isLastFolder && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-y-0 -left-3 w-px",
                doesActiveBranchContinue ? "bg-sky-500" : "bg-border/60"
              )}
            />
          )}
          <div
            className={cn(
              "relative before:absolute before:top-0 before:bottom-1/2 before:-left-3 before:w-px after:absolute after:top-1/2 after:-left-3 after:h-px after:w-3",
              isInPath || doesActiveBranchContinue
                ? "before:bg-sky-500"
                : "before:bg-border/60",
              isInPath ? "after:bg-sky-500" : "after:bg-border/60"
            )}
          >
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-auto min-h-9 w-full justify-start gap-2 rounded-lg whitespace-normal px-2 py-1.5 text-left text-sm font-normal transition-none hover:bg-accent hover:text-accent-foreground",
                isCurrent && "bg-accent text-accent-foreground"
              )}
              aria-current={isCurrent ? "page" : undefined}
              data-folder-state={getFolderVisualState(link, isInPath)}
              onClick={() => onSelectFolder(link, path)}
            >
              <HugeiconsIcon
                icon={getFolderIcon(link, isInPath)}
                className="shrink-0"
              />
              <FilenameText value={link.label} className="w-0 min-w-0 flex-1" />
            </Button>
          </div>
          {link.children?.some(isVisibleTreeFolder) && (
            <div className="ml-4 flex min-w-0 flex-col gap-1 pl-3">
              {renderFolders(link.children, path)}
            </div>
          )}
        </div>
      )
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-auto min-h-9 w-full justify-start gap-2 rounded-lg whitespace-normal px-2 py-1.5 text-left text-sm font-normal transition-none hover:bg-accent hover:text-accent-foreground",
          folderPath.length === 0 && "bg-accent text-accent-foreground"
        )}
        aria-current={folderPath.length === 0 ? "page" : undefined}
        onClick={onSelectRoot}
      >
        <HugeiconsIcon icon={Folder02Icon} className="shrink-0" />
        <FilenameText value={rootLabel} className="w-0 min-w-0 flex-1" />
      </Button>
      <div className="ml-4 flex min-w-0 flex-col gap-1 pl-3">
        {renderFolders(links, [])}
      </div>
    </div>
  )
}

const FinderEmptyState = ({
  item,
  actions,
  extractingItems,
  onExit,
  contentRef,
}: FinderEmptyStateProps) => (
  <section
    className="flex h-svh flex-col overflow-hidden bg-background"
    data-layout-guide-target="list-view"
  >
    <header
      className="flex min-h-16 shrink-0 items-center gap-3 border-b bg-background px-4 py-3 md:grid md:grid-cols-[16rem_minmax(0,1fr)_4rem] md:items-stretch md:gap-0 md:p-0"
      data-layout-guide-target="list-header"
    >
      <FinderBackButton onExit={onExit} />
      <h1
        aria-label={getItemTitle(item)}
        className="min-w-0 flex-1 text-base font-normal md:flex md:w-full md:items-center md:px-4 md:py-3"
      >
        <FilenameText
          value={getItemTitle(item)}
          clampClassName="line-clamp-1"
          className="w-full"
        />
      </h1>
      <div className={MEDIA_LIST_HEADER_MENU_CELL_CLASS}>
        <LinkItemMenu
          item={item}
          actions={actions}
          showRemove
          onRemoved={onExit}
          isRefreshing={extractingItems.has(item.url)}
          triggerClassName={MEDIA_LIST_ROW_MENU_TRIGGER_CLASS}
        />
      </div>
    </header>
    <div
      ref={contentRef}
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-x-hidden px-6 py-10 text-center"
      data-layout-guide-target="list-content"
    >
      <div className="flex flex-col gap-1">
        <p className="font-medium">No playable links</p>
        <p className="text-sm text-muted-foreground">
          Resolve this saved link to load its playable links.
        </p>
      </div>
      <Button variant="outline" onClick={() => actions.showLinks(item.url)}>
        Resolve links
      </Button>
    </div>
  </section>
)

const FinderBrowser = ({
  item,
  actions,
  extractingItems,
  onExit,
  shouldShowRowPosters = false,
}: FinderBrowserProps) => {
  const [isMobileFolderTreeOpen, setIsMobileFolderTreeOpen] = useState(false)
  const {
    rootLinks,
    folderPath,
    currentLinks,
    contentRef,
    openFolder,
    openLink,
    selectRoot,
  } = useFinderBrowserState({ item, actions, onExit })
  const currentFolderLabel = folderPath.at(-1)?.label ?? getItemTitle(item)
  const parentFolderName =
    folderPath.map((folderLevel) => folderLevel.label).join(" ") || undefined
  const shouldShowEpisodeStills =
    shouldShowRowPosters &&
    currentLinks.length > 0 &&
    currentLinks.every((link) => hasEpisodeMarker(link.label, parentFolderName))

  if (rootLinks.length === 0) {
    return (
      <FinderEmptyState
        item={item}
        actions={actions}
        extractingItems={extractingItems}
        onExit={onExit}
        contentRef={contentRef}
      />
    )
  }

  return (
    <section
      className="flex h-svh flex-col overflow-hidden bg-background"
      data-layout-guide-target="list-view"
    >
      <header
        className="flex min-h-16 shrink-0 items-center gap-3 border-b bg-background px-4 py-3 md:grid md:grid-cols-[16rem_minmax(0,1fr)_4rem] md:items-stretch md:gap-0 md:p-0"
        data-layout-guide-target="list-header"
      >
        <FinderBackButton onExit={onExit} />
        <div className="min-w-0 flex-1 md:flex md:w-full md:items-center md:px-4 md:py-3">
          <h1
            aria-label={getItemTitle(item)}
            className="w-full min-w-0 text-base font-normal"
          >
            <FilenameText
              value={getItemTitle(item)}
              clampClassName="line-clamp-1"
              className="w-full"
            />
          </h1>
        </div>
        <div className={MEDIA_LIST_HEADER_MENU_CELL_CLASS}>
          <LinkItemMenu
            item={item}
            actions={actions}
            showRemove
            onRemoved={onExit}
            isRefreshing={extractingItems.has(item.url)}
            triggerClassName={MEDIA_LIST_ROW_MENU_TRIGGER_CLASS}
          />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[16rem_minmax(0,1fr)] md:grid-rows-1">
        <aside
          className="min-w-0 overflow-x-hidden border-b px-4 py-3 md:border-r md:border-b-0 md:p-3"
          data-layout-guide-target="list-sidebar"
        >
          <MobileFolderTreeToggle
            currentFolderLabel={currentFolderLabel}
            isOpen={isMobileFolderTreeOpen}
            onToggle={() =>
              setIsMobileFolderTreeOpen(
                (currentIsMobileFolderTreeOpen) =>
                  !currentIsMobileFolderTreeOpen
              )
            }
          />
          <div
            className={cn(
              "mt-2 max-h-[40svh] overflow-y-auto pr-1",
              !isMobileFolderTreeOpen && "hidden",
              "md:mt-0 md:block md:max-h-none md:overflow-visible md:pr-0"
            )}
          >
            <FolderTree
              rootLabel={getItemTitle(item)}
              folderPath={folderPath}
              links={rootLinks}
              onSelectRoot={() => {
                selectRoot()
                setIsMobileFolderTreeOpen(false)
              }}
              onSelectFolder={(link, path) => {
                void openFolder(link, path)
                setIsMobileFolderTreeOpen(false)
              }}
            />
          </div>
        </aside>

        <div
          ref={contentRef}
          className="min-h-0 overflow-x-hidden overflow-y-auto overscroll-x-none overscroll-y-contain"
          data-layout-guide-target="list-content"
        >
          {currentLinks.map((link) => {
            const linkKey = getLinkKey(link)
            const linkTarget = getMediaNodeTargetOrUndefined(link)
            if (linkTarget !== undefined && isMirrorResolvable(link)) {
              return (
                <ResolvableContainerRow
                  key={linkKey}
                  item={item}
                  link={link}
                  actions={actions}
                  isResolving={extractingItems.has(linkTarget)}
                  shouldShowRowPosters={shouldShowRowPosters}
                  episodeStill={
                    shouldShowEpisodeStills
                      ? {
                          label: link.label,
                          parentFolderName,
                        }
                      : undefined
                  }
                  onRemove={() =>
                    actions.removeLink?.(item.url, linkKey, linkTarget)
                  }
                />
              )
            }
            const isFolder = getMediaNodeInteractionState(link).isFolder
            const isExpired =
              !isFolder &&
              link.expiry !== undefined &&
              link.expiry <= Date.now()
            const isResolving =
              linkTarget !== undefined && extractingItems.has(linkTarget)
            const rowFallbackIcon = isResolving ? (
              <Spinner
                aria-label={`Loading ${link.label}…`}
                className="size-6"
              />
            ) : (
              <HugeiconsIcon
                icon={isFolder ? getFolderIcon(link, false) : PlayIcon}
                className="size-6"
              />
            )
            const copyLink = () => {
              if (linkTarget === undefined) {
                return
              }
              void navigator.clipboard.writeText(linkTarget)
            }
            const openLinkInPlayer = async (player: PlayerDefinition) => {
              if (linkTarget === undefined) {
                return
              }
              const result = await openInSpecificPlayer(linkTarget, player)
              markAfterAcceptedHandoff({
                accepted: result.expectsNavigation,
                itemLabel: link.label,
                markOpened: () => actions.markOpened(item.url, linkTarget),
              })
            }

            return (
              <MediaListRow
                key={linkKey}
                shouldStackIconOnMobile={shouldShowEpisodeStills}
                icon={
                  shouldShowEpisodeStills ? (
                    <FinderEpisodeStill
                      label={link.label}
                      parentFolderName={parentFolderName}
                      fallbackIcon={rowFallbackIcon}
                      isResolving={isResolving}
                      isDimmed={isExpired}
                    />
                  ) : shouldShowRowPosters && !isFolder ? (
                    <SaveListRowPoster
                      label={link.label}
                      parentFolderName={parentFolderName}
                      fallbackIcon={rowFallbackIcon}
                      isDimmed={isExpired}
                    />
                  ) : shouldShowRowPosters ? (
                    <SaveListRowPoster
                      label={link.label}
                      parentFolderName={parentFolderName}
                      isContainer
                      isIconWhenArtworkMissing
                      fallbackIcon={rowFallbackIcon}
                      isDimmed={isExpired}
                    />
                  ) : (
                    <SaveListRowIcon
                      className={
                        isExpired ? "text-muted-foreground" : undefined
                      }
                    >
                      {rowFallbackIcon}
                    </SaveListRowIcon>
                  )
                }
                title={
                  <FilenameText
                    value={
                      shouldShowRowPosters
                        ? (getMediaDisplayTitle(link.label, parentFolderName) ??
                          link.label)
                        : link.label
                    }
                    className={MEDIA_LIST_ROW_TITLE_CLASS}
                    textClassName={isExpired ? "line-through" : undefined}
                  />
                }
                meta={
                  <>
                    {!link.opened && !isExpired && (
                      <NewBadge className="md:hidden" />
                    )}
                    {link.expiry !== undefined && (
                      <span className="flex justify-end text-xs text-muted-foreground">
                        <PlayableExpiryBadge
                          expiresAt={link.expiry}
                          expirySource={link.expirySource}
                        />
                      </span>
                    )}
                  </>
                }
                trailing={
                  <>
                    {link.size && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {link.size}
                      </span>
                    )}
                    {!link.opened && !isExpired && (
                      <NewBadge className="hidden md:inline-flex" />
                    )}
                  </>
                }
                overlay={
                  !isFolder && !isResolving ? (
                    <LinkActionsDotMenu
                      itemLabel={link.label}
                      onCopyLink={copyLink}
                      onOpenInPlayer={openLinkInPlayer}
                      isPlayable={!isExpired}
                      className={MEDIA_LIST_ROW_MENU_TRIGGER_CLASS}
                    />
                  ) : undefined
                }
                onActivate={() => void openLink(link)}
                disabled={isExpired}
                isOpened={link.opened === true}
                buttonClassName={
                  isExpired ? "text-muted-foreground" : undefined
                }
                buttonDataAttributes={{
                  "data-folder-state": isFolder
                    ? getFolderVisualState(link, false)
                    : undefined,
                }}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}

interface SaveListRootRowIconProps {
  readonly shouldShowRowPosters: boolean
  readonly didExtractionFail: boolean
  readonly isExtractionIncomplete: boolean
  readonly directLinkLabel: string | undefined
  readonly itemTitle: string
  readonly isDirectLinkExpired: boolean
}

const SaveListRootRowIcon = ({
  shouldShowRowPosters,
  didExtractionFail,
  isExtractionIncomplete,
  directLinkLabel,
  itemTitle,
  isDirectLinkExpired,
}: SaveListRootRowIconProps) => {
  const fallbackIcon = isExtractionIncomplete ? (
    didExtractionFail ? (
      <HugeiconsIcon icon={AlertCircleIcon} className="size-6" />
    ) : (
      <Spinner aria-hidden="true" className="size-6" />
    )
  ) : directLinkLabel ? (
    <HugeiconsIcon icon={PlayIcon} className="size-6" />
  ) : (
    <HugeiconsIcon icon={Folder01Icon} className="size-6" />
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
  currentTimeMs = Date.now(),
  shouldShowRowPosters = false,
}: SaveListBrowserProps) => {
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

  const groupedItems = groupSaveListItems(items, currentTimeMs)

  return (
    <section
      className={SAVE_LIST_SECTION_STACK_CLASS}
      data-layout-guide-target="list-view"
    >
      {groupedItems.map((group) => (
        <SaveDateGroupSection key={group.key} label={group.label}>
          <div className="stagger-children flex flex-col divide-y divide-border/70">
            {group.items.map((item) => {
              const itemKey = item.id ?? item.url
              const view = toLinkViewModel(item)
              const interactionState = getSavedLinkInteractionState(
                item,
                currentTimeMs
              )
              const { directLink, isDirectLinkExpired, isResolvableContainer } =
                interactionState
              const isExtracting = extractingItems.has(item.url)
              const extractionState = item.extractionStatus?.state ?? "complete"
              const isExtractionIncomplete = extractionState !== "complete"
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
                    shouldShowRowPosters={shouldShowRowPosters}
                    onRemove={() => actions.remove(item.url, item.id)}
                  />
                )
              }

              return (
                <div
                  key={itemKey}
                  className={cn(
                    "group relative flex items-stretch",
                    SAVE_LIST_ROW_ENTER_ANIMATION_CLASS
                  )}
                  data-layout-guide-target="list-row"
                  data-highlighted={
                    highlightedId === item.id ? true : undefined
                  }
                  data-extraction-state={extractionState}
                >
                  <div
                    className={cn(
                      "relative flex min-h-20 min-w-0 flex-1 items-center gap-0 px-3 py-4 md:gap-3 md:px-4 md:py-5",
                      !isDirectLinkExpired &&
                        !isExtractionIncomplete &&
                        "hover:bg-muted/70",
                      directLink?.opened &&
                        !isDirectLinkExpired &&
                        "bg-sky-500/15 hover:bg-sky-500/20"
                    )}
                  >
                    <button
                      type="button"
                      disabled={isDirectLinkExpired || isExtractionIncomplete}
                      aria-label={
                        isExtractionIncomplete
                          ? `${getExtractionStatusLabel(item, isExtracting)} for ${getItemTitle(item)}`
                          : directLink
                            ? `Open ${directLink.label || getItemTitle(item)}`
                            : `View ${getItemTitle(item)}`
                      }
                      className={cn(
                        "absolute inset-0 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        (isDirectLinkExpired || isExtractionIncomplete) &&
                          "cursor-not-allowed"
                      )}
                      onClick={() => {
                        if (isExtractionIncomplete) {
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
                                    actions.markOpened(
                                      item.url,
                                      directLinkTarget
                                    )
                                  }
                                },
                              })
                            )
                            .catch(console.error)
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
                        isDirectLinkExpired &&
                          "text-muted-foreground opacity-60",
                        isExtractionIncomplete && "text-muted-foreground"
                      )}
                    >
                      <SaveListRootRowIcon
                        shouldShowRowPosters={shouldShowRowPosters}
                        didExtractionFail={extractionState === "failed"}
                        isExtractionIncomplete={isExtractionIncomplete}
                        directLinkLabel={directLink?.label}
                        itemTitle={getItemTitle(item)}
                        isDirectLinkExpired={isDirectLinkExpired}
                      />
                      <span className="min-w-0 flex-1">
                        {isExtractionIncomplete ? (
                          <SaveExtractionStatus
                            item={item}
                            isRefreshing={isExtracting}
                            isTitle
                          />
                        ) : (
                          <>
                            <FilenameText
                              value={directLink?.label || getItemTitle(item)}
                              className={cn(
                                MEDIA_LIST_ROW_TITLE_CLASS,
                                "[&_button]:pointer-events-auto [&_button]:relative [&_button]:z-10"
                              )}
                              textClassName={
                                isDirectLinkExpired ? "line-through" : undefined
                              }
                            />
                            <span className="mt-1 flex min-w-0 flex-col items-start gap-1 text-xs text-muted-foreground md:flex-row md:items-center md:gap-1.5">
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
                              {!directLink && isRootItemNew && (
                                <span className="flex items-center gap-2 md:hidden">
                                  <NewBadge className="md:hidden" />
                                </span>
                              )}
                              {directLink &&
                                (isRootItemNew ||
                                  directLink.expiry !== undefined) && (
                                  <span className="flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-1.5">
                                    {directLink.expiry !== undefined && (
                                      <>
                                        <span
                                          aria-hidden="true"
                                          className="hidden md:inline"
                                        >
                                          ·
                                        </span>
                                        <PlayableExpiryBadge
                                          expiresAt={directLink.expiry}
                                          expirySource={directLink.expirySource}
                                        />
                                      </>
                                    )}
                                    {isRootItemNew && (
                                      <NewBadge className="md:hidden" />
                                    )}
                                  </span>
                                )}
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                    {isRootItemNew && (
                      <NewBadge className="relative z-10 hidden md:inline-flex" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "flex items-center justify-center",
                      MEDIA_LIST_ROW_MENU_CELL_CLASS
                    )}
                  >
                    <LinkItemMenu
                      item={item}
                      actions={actions}
                      playableLink={directLink}
                      isPlayableLinkExpired={isDirectLinkExpired}
                      showRemove
                      isRefreshing={isExtracting}
                      triggerClassName={MEDIA_LIST_ROW_MENU_TRIGGER_CLASS}
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

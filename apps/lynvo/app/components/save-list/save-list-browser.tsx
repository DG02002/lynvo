import { useMemo, useState, type ReactNode, type RefObject } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  AlertCircleIcon,
  Folder01Icon,
  Folder02Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "~/components/ui/button"
import { LinkItemMenu } from "~/components/links/link-item-menu"
import { LinkActionsDotMenu } from "~/components/links/link-actions-context-menu"
import { NewBadge } from "~/components/save-list/new-badge"
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
import { ExpandableFilename } from "~/components/expandable-filename"
import { getSavedLinkInteractionState } from "~/features/links/saved-link-interaction"
import {
  getMediaDisplayTitle,
  getEpisodeListingLabels,
  hasEpisodeMarker,
  isEpisodeOnlyListing,
} from "~/features/links/media-artwork/media-artwork-identity"
import { getSharedSeasonIdentity } from "~/features/links/media-artwork/hybrid-card-grouping"
import { parseMediaFilename } from "~/features/links/media-artwork/media-filename-parser"
import { getLinkViewItemMetadata } from "~/features/links/link-metadata-accessors"
import {
  getMediaNodeInteractionState,
  getMediaNodeTargetOrUndefined,
} from "~/features/links/media-node-interaction"
import {
  getFolderIcon,
  getFolderVisualState,
  getItemTitle,
  getLinkKey,
  getResolvableSourceName,
  isMirrorResolvable,
  type FolderLevel,
} from "./save-list-browser-model"
import { useFinderBrowserState } from "./use-finder-browser-state"
import { useFolderTitleDisplay } from "./use-folder-title-display"
import { markAfterAcceptedHandoff } from "~/lib/opened-confirmation-events"
import { groupSaveListItems } from "./save-list-groups"
import { ExtractionFailedActions } from "./extraction-failed-actions"
import { ResolvableContainerRow } from "./resolvable-container-row"
import {
  EpisodeStillSlot,
  FinderEpisodeStillDisplay,
  useFinderEpisodeStill,
} from "./finder-episode-still"
import { SaveListRowPoster } from "./save-list-row-poster"
import {
  MediaListRowMeta,
  MediaListRow,
  SaveListRowIcon,
} from "./media-list-row"
import {
  MEDIA_LIST_HEADER_MENU_CELL_CLASS,
  MEDIA_LIST_ROW_HOVER_TINT_CLASS,
  MEDIA_LIST_ROW_MENU_CELL_CLASS,
  MEDIA_LIST_ROW_MENU_TRIGGER_CLASS,
  MEDIA_LIST_ROW_OPENED_TINT_CLASS,
  MEDIA_LIST_ROW_TITLE_CLASS,
  SAVE_LIST_ROW_ENTER_ANIMATION_CLASS,
} from "./media-list-row-constants"
import {
  FINDER_FOLDER_CONTENT_GRID_CLASS,
  HYBRID_GROUP_CONTENT_CLASS,
  SAVE_LIST_BROWSER_LAYOUT_CLASS,
  SAVE_LIST_IMMERSIVE_HEADER_GRID_CLASS,
} from "./save-list-layout-constants"
import { SeasonArtworkPanel } from "./season-artwork-panel"
import {
  SAVE_LIST_SECTION_STACK_CLASS,
  SaveDateGroupSection,
} from "./save-date-group-heading"
import { ExtractionStatusTitle } from "./extraction-status"
import {
  getExtractionStatusInput,
  getExtractionStatusLabel,
  getExtractionStatusTitleSpec,
} from "./extraction-status-utils"
import { SaveListEmptyState, SaveListLoadingState } from "./save-list-state"
import {
  FolderTitleDisplayToggleButton,
  SaveListBackButton,
} from "./save-list-header-controls"

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

interface SaveListBrowserItemIconProps {
  readonly label: string
  readonly parentFolderName?: string
  readonly presentation: "link-poster" | "container-poster" | "icon"
  readonly rowFallbackIcon: ReactNode
  readonly isExpired: boolean
}

const getSaveListBrowserItemIconPresentation = (
  shouldShowRowPosters: boolean,
  isFolder: boolean
) => {
  if (!shouldShowRowPosters) {
    return "icon"
  }

  if (isFolder) {
    return "container-poster"
  }

  return "link-poster"
}

const SaveListBrowserItemIcon = ({
  label,
  parentFolderName,
  presentation,
  rowFallbackIcon,
  isExpired,
}: SaveListBrowserItemIconProps) => {
  if (presentation === "link-poster") {
    return (
      <SaveListRowPoster
        label={label}
        parentFolderName={parentFolderName}
        fallbackIcon={rowFallbackIcon}
        isDimmed={isExpired}
      />
    )
  }

  if (presentation === "container-poster") {
    return (
      <SaveListRowPoster
        label={label}
        parentFolderName={parentFolderName}
        isContainer
        isIconWhenArtworkMissing
        fallbackIcon={rowFallbackIcon}
        isDimmed={isExpired}
      />
    )
  }

  return (
    <SaveListRowIcon
      className={isExpired ? "text-muted-foreground" : undefined}
    >
      {rowFallbackIcon}
    </SaveListRowIcon>
  )
}

interface SaveListItemAriaLabelOptions {
  readonly itemTitle: string
  readonly directLink: ExtractedLink | undefined
  readonly isExtractionIncomplete: boolean
  readonly extractionStatusLabel: string
}

const getSaveListItemAriaLabel = ({
  itemTitle,
  directLink,
  isExtractionIncomplete,
  extractionStatusLabel,
}: SaveListItemAriaLabelOptions) => {
  if (isExtractionIncomplete) {
    return `${extractionStatusLabel} for ${itemTitle}`
  }

  if (directLink) {
    return `Open ${directLink.label || itemTitle}`
  }

  return `View ${itemTitle}`
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
              "group relative before:absolute before:top-0 before:bottom-1/2 before:-left-3 before:w-px after:absolute after:top-1/2 after:-left-3 after:h-px after:w-3",
              isInPath || doesActiveBranchContinue
                ? "before:bg-sky-500"
                : "before:bg-border/60",
              isInPath ? "after:bg-sky-500" : "after:bg-border/60"
            )}
          >
            <button
              type="button"
              aria-label={link.label}
              aria-current={isCurrent ? "page" : undefined}
              data-folder-state={getFolderVisualState(link, isInPath)}
              className={cn(
                "absolute inset-0 z-1 cursor-pointer rounded-lg transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring group-hover:bg-accent",
                isCurrent && "bg-accent"
              )}
              onClick={() => onSelectFolder(link, path)}
            />
            <div
              className={cn(
                "pointer-events-none relative z-2 flex h-auto min-h-9 w-full gap-2 whitespace-normal px-2 py-1.5 text-left text-sm font-normal transition-none group-hover:text-accent-foreground",
                isCurrent && "text-accent-foreground"
              )}
            >
              <HugeiconsIcon
                icon={getFolderIcon(link, isInPath)}
                className="shrink-0"
              />
              <ExpandableFilename
                value={link.label}
                className="w-0 min-w-0 flex-1"
                isInsideActivationOverlay
              />
            </div>
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
      <div className="group relative">
        <button
          type="button"
          aria-label={rootLabel}
          aria-current={folderPath.length === 0 ? "page" : undefined}
          className={cn(
            "absolute inset-0 z-1 cursor-pointer rounded-lg transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring group-hover:bg-accent",
            folderPath.length === 0 && "bg-accent"
          )}
          onClick={onSelectRoot}
        />
        <div
          className={cn(
            "pointer-events-none relative z-2 flex h-auto min-h-9 w-full gap-2 whitespace-normal px-2 py-1.5 text-left text-sm font-normal transition-none group-hover:text-accent-foreground",
            folderPath.length === 0 && "text-accent-foreground"
          )}
        >
          <HugeiconsIcon icon={Folder02Icon} className="shrink-0" />
          <ExpandableFilename
            value={rootLabel}
            className="w-0 min-w-0 flex-1"
            isInsideActivationOverlay
          />
        </div>
      </div>
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
    className={cn(
      SAVE_LIST_BROWSER_LAYOUT_CLASS,
      "flex h-svh flex-col overflow-hidden bg-background"
    )}
  >
    <header className={SAVE_LIST_IMMERSIVE_HEADER_GRID_CLASS}>
      <SaveListBackButton onNavigateBack={onExit} />
      <div className="min-w-0 md:flex md:w-full md:items-center md:px-4 md:py-3">
        <h1
          aria-label={getItemTitle(item)}
          className="hidden text-base font-normal md:block"
        >
          <ExpandableFilename
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
    <div
      ref={contentRef}
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-x-hidden px-6 py-10 text-center"
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

interface FinderBrowserLinkRowProps {
  readonly item: LinkViewItem
  readonly link: ExtractedLink
  readonly linkKey: string
  readonly actions: LinkItemActions
  readonly extractingItems: Set<string>
  readonly parentFolderName?: string
  readonly shouldShowEpisodeStills: boolean
  readonly shouldStackEpisodeStill: boolean
  readonly shouldShowRowPosters: boolean
  readonly titleDisplay: FolderTitleDisplay
  readonly displayTitle: string
  readonly onActivate: () => void
}

const FinderBrowserLinkRow = ({
  item,
  link,
  linkKey,
  actions,
  extractingItems,
  parentFolderName,
  shouldShowEpisodeStills,
  shouldStackEpisodeStill,
  shouldShowRowPosters,
  titleDisplay,
  displayTitle,
  onActivate,
}: FinderBrowserLinkRowProps) => {
  const linkTarget = getMediaNodeTargetOrUndefined(link)
  const { isFolder } = getMediaNodeInteractionState(link)
  const shouldShowEpisodeStillForLink =
    shouldShowEpisodeStills && hasEpisodeMarker(link.label, parentFolderName)
  const isExpired =
    !isFolder && link.expiry !== undefined && link.expiry <= Date.now()
  const isResolving =
    linkTarget !== undefined && extractingItems.has(linkTarget)
  const episodeStill = useFinderEpisodeStill(
    link.label,
    parentFolderName,
    shouldShowEpisodeStillForLink
  )
  const rowDisplayTitle =
    shouldShowEpisodeStillForLink && titleDisplay === "episode"
      ? episodeStill.episodeDisplayTitle
      : displayTitle
  const shouldStackIconOnMobile =
    shouldStackEpisodeStill && shouldShowEpisodeStillForLink
  const shouldCenterMobileNewBadge =
    shouldStackIconOnMobile && titleDisplay === "episode"
  const rowFallbackIcon = isResolving ? (
    <Spinner aria-label={`Loading ${link.label}…`} className="size-6" />
  ) : (
    <HugeiconsIcon
      icon={isFolder ? getFolderIcon(link, false) : PlayIcon}
      className="size-6"
    />
  )
  const episodeStillElement = (
    <FinderEpisodeStillDisplay
      label={link.label}
      fallbackIcon={rowFallbackIcon}
      isResolving={isResolving}
      isDimmed={isExpired}
      isWatched={link.opened === true}
      imagePath={episodeStill.imagePath}
      imageType={episodeStill.imageType}
      isLookupPending={episodeStill.isLookupPending}
    />
  )
  const renderRowIcon = (): ReactNode => {
    if (!shouldShowEpisodeStillForLink) {
      if (shouldShowEpisodeStills) {
        return (
          <SaveListRowIcon
            className={isExpired ? "text-muted-foreground" : undefined}
          >
            {rowFallbackIcon}
          </SaveListRowIcon>
        )
      }
      return (
        <SaveListBrowserItemIcon
          label={link.label}
          parentFolderName={parentFolderName}
          presentation={getSaveListBrowserItemIconPresentation(
            shouldShowRowPosters,
            isFolder
          )}
          rowFallbackIcon={rowFallbackIcon}
          isExpired={isExpired}
        />
      )
    }
    return (
      <EpisodeStillSlot
        stackOnMobile={shouldStackEpisodeStill}
        mobileFallback={
          <SaveListRowIcon
            className={isExpired ? "text-muted-foreground" : undefined}
          >
            {rowFallbackIcon}
          </SaveListRowIcon>
        }
      >
        {episodeStillElement}
      </EpisodeStillSlot>
    )
  }
  const rowIcon = renderRowIcon()
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
      label={rowDisplayTitle}
      icon={rowIcon}
      title={{ value: rowDisplayTitle, isStruckThrough: isExpired }}
      titleExtractionStatus={isResolving ? { status: "waiting" } : undefined}
      meta={
        <>
          <MediaListRowMeta
            sourceName={getResolvableSourceName(link, item)}
            size={link.size}
          />
          {!isFolder && link.expiry !== undefined && (
            <PlayableExpiryBadge
              expiresAt={link.expiry}
              expirySource={link.expirySource}
            />
          )}
        </>
      }
      newBadge={
        !link.opened && !isExpired
          ? {
              mobilePlacement: shouldCenterMobileNewBadge
                ? "centered"
                : "metadata",
            }
          : undefined
      }
      overlay={
        !isResolving && linkTarget !== undefined ? (
          <LinkActionsDotMenu
            itemLabel={link.label}
            onCopyLink={copyLink}
            onOpenInPlayer={openLinkInPlayer}
            isPlayable={!isFolder && !isExpired}
            className={MEDIA_LIST_ROW_MENU_TRIGGER_CLASS}
            removeRequest={
              isFolder
                ? {
                    url: linkTarget,
                    onRemove: () =>
                      actions.removeLink?.(item.url, linkKey, linkTarget),
                  }
                : undefined
            }
            removeLabel={isFolder ? "Remove folder" : undefined}
          />
        ) : undefined
      }
      onActivate={onActivate}
      disabled={isExpired}
      isOpened={link.opened === true}
      shouldStackIconOnMobile={shouldStackIconOnMobile}
      buttonClassName={isExpired ? "text-muted-foreground" : undefined}
      buttonDataAttributes={{
        "data-folder-state": isFolder
          ? getFolderVisualState(link, false)
          : undefined,
      }}
    />
  )
}

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
    navigateToParentFolder,
    selectRoot,
  } = useFinderBrowserState({ item, actions, onExit })
  const currentFolderLabel = folderPath.at(-1)?.label ?? getItemTitle(item)
  const parentFolderName =
    folderPath.map((folderLevel) => folderLevel.label).join(" ") || undefined
  const episodeListingLabels = getEpisodeListingLabels(
    currentLinks,
    parentFolderName
  )
  const shouldShowEpisodeStills =
    shouldShowRowPosters &&
    episodeListingLabels.length > 0 &&
    isEpisodeOnlyListing(episodeListingLabels, parentFolderName)
  const sharedSeasonIdentity = useMemo(
    () =>
      shouldShowRowPosters
        ? getSharedSeasonIdentity(
            episodeListingLabels,
            parentFolderName,
            getItemTitle(item)
          )
        : undefined,
    [episodeListingLabels, parentFolderName, shouldShowRowPosters, item]
  )
  const headerTitle = sharedSeasonIdentity?.displayTitle ?? getItemTitle(item)
  const seasonArtworkRequest = useMemo<MediaArtworkRequest | undefined>(() => {
    if (!sharedSeasonIdentity) {
      return undefined
    }
    // A stored pick is authoritative: resolve by immutable id instead of
    // matching the season title again.
    const storedArtwork = getLinkViewItemMetadata(item).artwork
    if (storedArtwork) {
      return {
        mediaKind: storedArtwork.mediaKind ?? "tv",
        title: storedArtwork.title,
        providerId: storedArtwork.providerId,
        year: storedArtwork.year,
      }
    }
    return {
      mediaKind: "tv",
      title: sharedSeasonIdentity.requestTitle,
      year: sharedSeasonIdentity.year,
      seasonNumber: sharedSeasonIdentity.seasonNumber,
    }
  }, [item, sharedSeasonIdentity])
  const sortedCurrentLinks = useMemo(() => {
    if (!sharedSeasonIdentity) {
      return currentLinks
    }
    const linkEntries = currentLinks.map((link, linkIndex) => ({
      link,
      linkIndex,
    }))
    return linkEntries
      .toSorted(
        (firstEntry, secondEntry) =>
          (parseMediaFilename(firstEntry.link.label, parentFolderName)
            .episodeNumber ?? firstEntry.linkIndex) -
          (parseMediaFilename(secondEntry.link.label, parentFolderName)
            .episodeNumber ?? secondEntry.linkIndex)
      )
      .map((entry) => entry.link)
  }, [currentLinks, parentFolderName, sharedSeasonIdentity])
  const [titleDisplay, toggleTitleDisplay] = useFolderTitleDisplay(
    shouldShowRowPosters ? "episode" : "filename"
  )
  const currentTitleDisplay = shouldShowEpisodeStills
    ? titleDisplay
    : "filename"
  const getRowDisplayTitle = (link: ExtractedLink) =>
    currentTitleDisplay === "episode"
      ? (getMediaDisplayTitle(link.label, parentFolderName) ?? link.label)
      : link.label

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
      className={cn(
        SAVE_LIST_BROWSER_LAYOUT_CLASS,
        "flex h-svh flex-col overflow-hidden bg-background"
      )}
    >
      <header className={SAVE_LIST_IMMERSIVE_HEADER_GRID_CLASS}>
        <SaveListBackButton onNavigateBack={navigateToParentFolder} />
        <div className="min-w-0 md:flex md:w-full md:items-center md:px-4 md:py-3">
          <h1
            aria-label={headerTitle}
            className="hidden w-full min-w-0 text-base font-normal md:block"
          >
            <ExpandableFilename
              value={headerTitle}
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
        className={
          sharedSeasonIdentity
            ? HYBRID_GROUP_CONTENT_CLASS
            : FINDER_FOLDER_CONTENT_GRID_CLASS
        }
      >
        {sharedSeasonIdentity ? (
          <aside className="border-b bg-muted/50 p-4 md:border-b-0 md:border-r md:p-6 dark:bg-transparent">
            <SeasonArtworkPanel
              displayTitle={sharedSeasonIdentity.displayTitle}
              artworkRequest={seasonArtworkRequest}
            />
          </aside>
        ) : (
          <aside className="min-w-0 overflow-x-hidden border-b px-4 py-3 md:border-r md:border-b-0 md:p-3">
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
        )}

        <div
          ref={contentRef}
          className={cn(
            "min-h-0 overscroll-x-none",
            sharedSeasonIdentity
              ? "md:overflow-x-hidden md:overflow-y-auto md:overscroll-y-contain"
              : "overflow-x-hidden overflow-y-auto overscroll-y-contain"
          )}
        >
          {sortedCurrentLinks.map((link) => {
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
                  episodeStill={
                    shouldShowEpisodeStills &&
                    hasEpisodeMarker(link.label, parentFolderName)
                      ? {
                          parentFolderName,
                          titleDisplay: currentTitleDisplay,
                          stackOnMobile: Boolean(sharedSeasonIdentity),
                        }
                      : undefined
                  }
                  displayTitle={getRowDisplayTitle(link)}
                  onRemove={() =>
                    actions.removeLink?.(item.url, linkKey, linkTarget)
                  }
                />
              )
            }

            return (
              <FinderBrowserLinkRow
                key={linkKey}
                item={item}
                link={link}
                linkKey={linkKey}
                actions={actions}
                extractingItems={extractingItems}
                parentFolderName={parentFolderName}
                shouldShowEpisodeStills={shouldShowEpisodeStills}
                shouldStackEpisodeStill={Boolean(sharedSeasonIdentity)}
                shouldShowRowPosters={shouldShowRowPosters}
                titleDisplay={currentTitleDisplay}
                displayTitle={getRowDisplayTitle(link)}
                onActivate={() => void openLink(link)}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
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
    return <Spinner aria-hidden="true" className="size-6" />
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
    <section className={SAVE_LIST_SECTION_STACK_CLASS}>
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
                  data-highlighted={
                    highlightedId === item.id ? true : undefined
                  }
                  data-extraction-state={extractionState}
                >
                  <div className="flex min-h-20 min-w-0 flex-1 items-center gap-0 px-3 py-4 md:gap-3 md:px-4 md:py-5">
                    <button
                      type="button"
                      disabled={isDirectLinkExpired || isExtractionIncomplete}
                      aria-label={getSaveListItemAriaLabel({
                        itemTitle: getItemTitle(item),
                        directLink,
                        isExtractionIncomplete,
                        extractionStatusLabel: getExtractionStatusLabel(
                          item,
                          isExtracting
                        ),
                      })}
                      className={cn(
                        "absolute inset-0 z-1 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        !isDirectLinkExpired &&
                          !isExtractionIncomplete &&
                          MEDIA_LIST_ROW_HOVER_TINT_CLASS,
                        directLink?.opened &&
                          !isDirectLinkExpired &&
                          MEDIA_LIST_ROW_OPENED_TINT_CLASS,
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
                        "pointer-events-none relative z-2 min-w-0 flex-1 items-center gap-2 text-left md:gap-3",
                        "flex",
                        isDirectLinkExpired &&
                          "text-muted-foreground opacity-60",
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
                            textClassName={
                              isDirectLinkExpired ? "line-through" : undefined
                            }
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
                                  expirySource={directLink.expirySource}
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
                            className="mt-1.5"
                          />
                        )}
                      </span>
                    </div>
                    {isRootItemNew && (
                      <NewBadge className="relative z-10 hidden md:inline-flex" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "relative z-2 flex items-center justify-center",
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

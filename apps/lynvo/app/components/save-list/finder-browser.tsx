import {
  ArrowDown01Icon,
  Folder02Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useState, type ReactNode, type RefObject } from "react"
import type { MediaArtworkRequest } from "~shared/api-contracts"

import { ExpandableFilename } from "~/components/expandable-filename"
import { LinkActionsDotMenu } from "~/components/links/link-actions-context-menu"
import { LinkItemMenu } from "~/components/links/link-item-menu"
import { PlayableExpiryBadge } from "~/components/save-list/playable-expiry-badge"
import { Button } from "~/components/ui/button"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { getLinkViewItemMetadata } from "~/features/links/link-metadata-accessors"
import { isPlayableLinkFresh } from "~/features/links/link-playback-metadata"
import {
  getEpisodeListingLabels,
  getMediaDisplayTitle,
  getSharedSeasonIdentity,
  hasEpisodeMarker,
  isEpisodeOnlyListing,
} from "~/features/links/media-artwork"
import {
  getMediaNodeKey,
  getMediaNodeInteractionState,
  getMediaNodeTargetOrUndefined,
  isMirrorResolvableMediaNode,
} from "~/features/links/media-node-interaction"
import type { ExtractedLink, LinkViewItem } from "~/features/links/types"
import {
  openInSpecificPlayerForHandoff,
  type PlayerDefinition,
} from "~/lib/player-utils"
import { useMinuteTimeBucket } from "~/lib/use-coarse-time-bucket"
import { cn } from "~/lib/utils"

import {
  EpisodeStillSlot,
  FinderArtworkDisplay,
  useFinderEpisodeStill,
} from "./finder-media-artwork"
import {
  MediaListRowMeta,
  MediaListRow,
  SaveListRowIcon,
} from "./media-list-row"
import { ResolvableContainerRow } from "./resolvable-container-row"
import {
  getFolderIcon,
  getFolderVisualState,
  getItemTitle,
  getResolvableSourceName,
  type FolderLevel,
} from "./save-list-browser-model"
import { FolderTitleDisplayToggleButton } from "./save-list-header-controls"
import {
  FINDER_FOLDER_CONTENT_GRID_CLASS,
  GALLERY_GROUP_CONTENT_CLASS,
  SAVE_LIST_BROWSER_LAYOUT_CLASS,
} from "./save-list-layout-constants"
import { SaveListRowPoster } from "./save-list-row-poster"
import { useSaveListSession } from "./save-list-session"
import {
  compareByEpisodeNumber,
  ImmersiveBrowserHeader,
  openPlayableAndMarkOpened,
  SeasonArtworkAside,
  shouldCenterMobileNewBadge as getShouldCenterMobileNewBadge,
} from "./save-list-view-model"
import { SeasonArtworkPanel } from "./season-artwork-panel"
import { useFinderBrowserState } from "./use-finder-browser-state"
import { useFolderTitleDisplay } from "./use-folder-title-display"

interface FinderBrowserProps {
  item: LinkViewItem
  onExit: () => void
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

const isVisibleTreeFolder = (link: ExtractedLink) =>
  getMediaNodeInteractionState(link).isFolder &&
  !isMirrorResolvableMediaNode(link)

const MobileFolderTreeToggle = ({
  currentFolderLabel,
  isOpen,
  onToggle,
}: MobileFolderTreeToggleProps) => (
  <Button
    type="button"
    variant="finder-row"
    size="finder-row"
    className="md:hidden"
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
      folderPath.some((folder) => folder.id === getMediaNodeKey(link))
    )

    return visibleFolderLinks.map((link, index) => {
      const linkKey = getMediaNodeKey(link)
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
                doesActiveBranchContinue ? "bg-link" : "bg-border/60"
              )}
            />
          )}
          <div
            className={cn(
              "group relative before:absolute before:top-0 before:bottom-1/2 before:-left-3 before:w-px after:absolute after:top-1/2 after:-left-3 after:h-px after:w-3",
              isInPath || doesActiveBranchContinue
                ? "before:bg-link"
                : "before:bg-border/60",
              isInPath ? "after:bg-link" : "after:bg-border/60"
            )}
          >
            <button
              type="button"
              aria-label={link.label}
              aria-current={isCurrent ? "page" : undefined}
              data-folder-state={getFolderVisualState(link, isInPath)}
              className={cn(
                "absolute inset-0 cursor-pointer rounded-lg transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring group-hover:bg-accent",
                isCurrent && "bg-accent"
              )}
              onClick={() => onSelectFolder(link, path)}
            />
            <div
              className={cn(
                "pointer-events-none relative flex h-auto min-h-9 w-full gap-2 whitespace-normal px-2 py-1.5 text-left text-sm font-normal transition-none group-hover:text-accent-foreground",
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
            "absolute inset-0 cursor-pointer rounded-lg transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring group-hover:bg-accent",
            folderPath.length === 0 && "bg-accent"
          )}
          onClick={onSelectRoot}
        />
        <div
          className={cn(
            "pointer-events-none relative flex h-auto min-h-9 w-full gap-2 whitespace-normal px-2 py-1.5 text-left text-sm font-normal transition-none group-hover:text-accent-foreground",
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
    <ImmersiveBrowserHeader
      onNavigateBack={onExit}
      title={
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
      }
      menu={
        <LinkItemMenu
          item={item}
          actions={actions}
          showRemove
          onRemoved={onExit}
          isRefreshing={extractingItems.has(item.url)}
          triggerLook="media-row"
        />
      }
    />
    <div
      ref={contentRef}
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-x-hidden px-6 py-10 text-center"
    >
      <div className="flex flex-col gap-1">
        <p className="font-medium">No playable links</p>
        <p className="text-sm text-muted-foreground">
          Find playable links for this saved link.
        </p>
      </div>
      <Button variant="outline" onClick={() => actions.showLinks(item.url)}>
        Find playable links
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
  const currentTimeMs = useMinuteTimeBucket()
  const linkTarget = getMediaNodeTargetOrUndefined(link)
  const { isFolder } = getMediaNodeInteractionState(link)
  const shouldShowEpisodeStillForLink =
    shouldShowEpisodeStills && hasEpisodeMarker(link.label, parentFolderName)
  const isExpired = !isFolder && !isPlayableLinkFresh(link, currentTimeMs)
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
  const shouldCenterMobileNewBadge = getShouldCenterMobileNewBadge(
    shouldStackIconOnMobile,
    titleDisplay
  )
  const rowFallbackIcon = (
    <HugeiconsIcon
      icon={isFolder ? getFolderIcon(link, false) : PlayIcon}
      className="size-6"
    />
  )
  const rowStatusIcon = isResolving ? (
    <span
      aria-label={`Loading ${link.label}…`}
      className="loading-skeleton-pulse inline-flex"
      role="status"
    >
      {rowFallbackIcon}
    </span>
  ) : (
    rowFallbackIcon
  )
  const episodeStillElement = (
    <FinderArtworkDisplay
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
            {rowStatusIcon}
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
          rowFallbackIcon={rowStatusIcon}
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
            {rowStatusIcon}
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
  const openLinkInPlayer = (player: PlayerDefinition) => {
    if (linkTarget === undefined) {
      return
    }
    void openPlayableAndMarkOpened({
      actions,
      itemUrl: item.url,
      playableLink: link,
      open: () => openInSpecificPlayerForHandoff(linkTarget, player),
    })
  }

  return (
    <MediaListRow
      key={linkKey}
      label={rowDisplayTitle}
      icon={rowIcon}
      title={{ value: rowDisplayTitle }}
      titleExtractionStatus={isResolving ? { status: "waiting" } : undefined}
      meta={
        <>
          <MediaListRowMeta
            sourceName={getResolvableSourceName(link, item)}
            size={link.size}
          />
          {!isFolder && link.expiry !== undefined && (
            <PlayableExpiryBadge expiresAt={link.expiry} />
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
            isPlayable={!isFolder}
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

export const FinderBrowser = ({ item, onExit }: FinderBrowserProps) => {
  const { actions, extractingItems, shouldShowRowPosters } =
    useSaveListSession()
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
      .toSorted((firstEntry, secondEntry) =>
        compareByEpisodeNumber(
          { label: firstEntry.link.label, originalIndex: firstEntry.linkIndex },
          {
            label: secondEntry.link.label,
            originalIndex: secondEntry.linkIndex,
          },
          parentFolderName
        )
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
      <ImmersiveBrowserHeader
        onNavigateBack={navigateToParentFolder}
        title={
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
        }
        center={
          shouldShowEpisodeStills ? (
            <div className="flex items-center justify-center px-1 md:px-0">
              <FolderTitleDisplayToggleButton
                titleDisplay={titleDisplay}
                onToggle={toggleTitleDisplay}
              />
            </div>
          ) : null
        }
        menu={
          <LinkItemMenu
            item={item}
            actions={actions}
            showRemove
            onRemoved={onExit}
            isRefreshing={extractingItems.has(item.url)}
            triggerLook="media-row"
          />
        }
      />

      <div
        className={
          sharedSeasonIdentity
            ? GALLERY_GROUP_CONTENT_CLASS
            : FINDER_FOLDER_CONTENT_GRID_CLASS
        }
      >
        {sharedSeasonIdentity ? (
          <SeasonArtworkAside>
            <SeasonArtworkPanel
              displayTitle={sharedSeasonIdentity.displayTitle}
              artworkRequest={seasonArtworkRequest}
            />
          </SeasonArtworkAside>
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
            const linkKey = getMediaNodeKey(link)
            const linkTarget = getMediaNodeTargetOrUndefined(link)
            if (linkTarget !== undefined && isMirrorResolvableMediaNode(link)) {
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

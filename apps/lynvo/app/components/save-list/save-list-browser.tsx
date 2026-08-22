import { useState, type ComponentProps } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Archive04Icon,
  Folder01Icon,
  Folder02Icon,
  PackageIcon,
  PackageOpenIcon,
  PackageSearchIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "~/components/ui/button"
import { LinkItemMenu } from "~/components/links/link-item-menu"
import { LinkActionsDotMenu } from "~/components/links/link-actions-context-menu"
import { Spinner } from "~/components/ui/spinner"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import type {
  ExtractedLink,
  LinkListItem,
  LinkViewItem,
} from "~/features/links/types"
import { toLinkViewModel } from "~/features/links/link-view-models"
import { openInSpecificPlayer, type PlayerDefinition } from "~/lib/player-utils"
import { cn } from "~/lib/utils"
import { ResolvableLinkMenu } from "~/components/save-list/resolvable-link-menu"
import { PlayableExpiryBadge } from "~/components/save-list/playable-expiry-badge"
import { NewBadge } from "~/components/save-list/new-badge"
import { FilenameText } from "~/components/filename-text"
import { getSavedLinkInteractionState } from "~/features/links/saved-link-interaction"
import {
  getMediaNodeInteractionState,
  getMediaNodeTarget,
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
import { useResolvableContainerState } from "./use-resolvable-container-state"
import { markAfterAcceptedHandoff } from "~/lib/opened-confirmation-events"

interface SaveListBrowserProps {
  items: LinkListItem[]
  selectedItemUrl: string | null
  onSelectedItemUrlChange: (url: string | null) => void
  actions: LinkItemActions
  extractingItems: Set<string>
  highlightedId: string | null
  isHydrating: boolean
}

interface FinderBrowserProps {
  item: LinkViewItem
  actions: LinkItemActions
  extractingItems: Set<string>
  onExit: () => void
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
    <SaveListRowIcon icon={Folder02Icon} />
    <span className="min-w-0 flex-1 truncate">{currentFolderLabel}</span>
    <span className="flex size-9 shrink-0 items-center justify-center">
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        className={cn("size-4 transition-transform", isOpen && "rotate-180")}
      />
    </span>
  </Button>
)

const SaveListRowIcon = ({
  icon,
  className,
}: {
  icon: ComponentProps<typeof HugeiconsIcon>["icon"]
  className?: string
}) => (
  <span
    className={cn(
      "flex size-10 shrink-0 items-center justify-center text-foreground md:size-14",
      className
    )}
  >
    <HugeiconsIcon icon={icon} className="size-6" />
  </span>
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
}: FinderBrowserProps) => (
  <section className="flex h-svh flex-col overflow-hidden bg-background">
    <header className="flex min-h-16 shrink-0 items-center gap-3 border-b bg-background px-4 py-3 md:grid md:grid-cols-[16rem_minmax(0,1fr)_4rem] md:items-stretch md:gap-0 md:p-0">
      <div className="contents md:block md:h-full md:border-r">
        <Button
          variant="ghost"
          className="text-base hover:bg-transparent hover:text-foreground md:h-full md:w-full md:justify-center md:rounded-none md:px-4 md:hover:bg-muted/70"
          onClick={onExit}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
          Back
        </Button>
      </div>
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
      <div className="contents md:flex md:h-full md:items-center md:justify-center md:[&_button]:text-base md:[&_svg]:size-5!">
        <LinkItemMenu
          item={item}
          actions={actions}
          showRemove
          onRemoved={onExit}
          isRefreshing={extractingItems.has(item.url)}
        />
      </div>
    </header>
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
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

interface ResolvedMirrorRowsProps {
  mirrors: ExtractedLink[]
  sourceLink: ExtractedLink
  itemUrl: string
  actions: LinkItemActions
}

interface ResolvableContainerRowProps {
  item: LinkViewItem
  link: ExtractedLink
  actions: LinkItemActions
  isResolving: boolean
  onRemove: () => void
}

const ResolvedMirrorRows = ({
  mirrors,
  sourceLink,
  itemUrl,
  actions,
}: ResolvedMirrorRowsProps) => (
  <div className="flex flex-col border-t bg-sky-500/5">
    {mirrors.map((mirror) => {
      const mirrorTarget = getMediaNodeTarget(mirror)
      return (
        <div
          key={getLinkKey(mirror)}
          className="relative border-b last:border-b-0"
        >
          <Button
            variant="ghost"
            className="h-auto min-h-20 w-full justify-start gap-3 rounded-none px-4 py-4 pr-16 text-left font-normal hover:bg-sky-500/10"
            onClick={() => actions.play(mirror)}
          >
            <SaveListRowIcon icon={PlayIcon} />
            <FilenameText
              value={mirror.label}
              className="min-w-0 flex-1 text-sm md:text-lg"
            />
            {mirror.size && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {mirror.size}
              </span>
            )}
          </Button>
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <LinkActionsDotMenu
              itemLabel={mirror.label}
              onCopyLink={() =>
                void navigator.clipboard.writeText(mirrorTarget)
              }
              onOpenInPlayer={async (player) => {
                const result = await openInSpecificPlayer(mirrorTarget, player)
                markAfterAcceptedHandoff({
                  accepted: result.expectsNavigation,
                  itemLabel: mirror.label,
                  markOpened: () =>
                    actions.markOpened(itemUrl, getMediaNodeTarget(sourceLink)),
                })
              }}
              className="size-9 shrink-0 text-foreground"
            />
          </div>
        </div>
      )
    })}
  </div>
)

const ResolvableContainerRow = ({
  item,
  link,
  actions,
  isResolving,
  onRemove,
}: ResolvableContainerRowProps) => {
  const linkTarget = getMediaNodeTarget(link)
  const {
    mirrors,
    isExpanded,
    didResolutionFail,
    displaySize,
    resolutionState: resolvedState,
    openLink,
    refreshLink,
  } = useResolvableContainerState({ item, link, actions })
  const resolutionState = isResolving ? "resolving" : resolvedState

  return (
    <div className="flex flex-col border-b last:border-b-0">
      <div className="relative">
        <button
          type="button"
          className={cn(
            "flex min-h-24 w-full items-center gap-3 px-4 py-6 pr-16 text-left",
            "hover:bg-muted",
            link.opened && "bg-sky-500/15 hover:bg-sky-500/20",
            didResolutionFail && "bg-destructive/15 hover:bg-destructive/20"
          )}
          data-resolution-state={resolutionState}
          onClick={openLink}
        >
          <SaveListRowIcon
            icon={
              mirrors.length > 0
                ? isExpanded
                  ? PackageOpenIcon
                  : PackageIcon
                : PackageSearchIcon
            }
          />
          <span className="min-w-0 flex-1">
            <FilenameText
              value={link.label}
              className="block text-sm md:text-lg"
            />
            <span className="block truncate text-xs text-muted-foreground">
              {getResolvableSourceName(link, item)}
            </span>
          </span>
          {Boolean(displaySize) && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {displaySize}
            </span>
          )}
          {!link.opened && <NewBadge />}
          {isResolving ? (
            <Spinner aria-label={`Loading playable links for ${link.label}…`} />
          ) : mirrors.length > 0 ? (
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className={cn(
                "shrink-0 transition-transform",
                isExpanded && "rotate-90"
              )}
            />
          ) : null}
        </button>
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <ResolvableLinkMenu
            itemLabel={link.label}
            onCopyLink={() => void navigator.clipboard.writeText(linkTarget)}
            onRefresh={refreshLink}
            onRemove={onRemove}
          />
        </div>
      </div>
      {mirrors.length > 0 && isExpanded && (
        <ResolvedMirrorRows
          mirrors={mirrors}
          sourceLink={link}
          itemUrl={item.url}
          actions={actions}
        />
      )}
    </div>
  )
}

const FinderBrowser = ({
  item,
  actions,
  extractingItems,
  onExit,
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
  } = useFinderBrowserState({ item, actions })
  const currentFolderLabel = folderPath.at(-1)?.label ?? getItemTitle(item)

  if (rootLinks.length === 0) {
    return (
      <FinderEmptyState
        item={item}
        actions={actions}
        extractingItems={extractingItems}
        onExit={onExit}
      />
    )
  }

  return (
    <section className="flex h-svh flex-col overflow-hidden bg-background">
      <header className="flex min-h-16 shrink-0 items-center gap-3 border-b bg-background px-4 py-3 md:grid md:grid-cols-[16rem_minmax(0,1fr)_4rem] md:items-stretch md:gap-0 md:p-0">
        <div className="contents md:block md:h-full md:border-r">
          <Button
            variant="ghost"
            className="text-base hover:bg-transparent hover:text-foreground md:h-full md:w-full md:justify-center md:rounded-none md:px-4 md:hover:bg-muted/70"
            onClick={onExit}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
            Back
          </Button>
        </div>
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
        <div className="contents md:flex md:h-full md:items-center md:justify-center md:[&_button]:text-base md:[&_svg]:size-5!">
          <LinkItemMenu
            item={item}
            actions={actions}
            showRemove
            onRemoved={onExit}
            isRefreshing={extractingItems.has(item.url)}
          />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[16rem_minmax(0,1fr)] md:grid-rows-1">
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

        <div
          ref={contentRef}
          className="min-h-0 overflow-y-auto overscroll-contain"
        >
          {currentLinks.map((link) => {
            const linkKey = getLinkKey(link)
            const linkTarget = getMediaNodeTarget(link)
            if (isMirrorResolvable(link)) {
              return (
                <ResolvableContainerRow
                  key={linkKey}
                  item={item}
                  link={link}
                  actions={actions}
                  isResolving={extractingItems.has(linkTarget)}
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
            const isResolving = extractingItems.has(linkTarget)
            const copyLink = () => {
              void navigator.clipboard.writeText(linkTarget)
            }
            const openLinkInPlayer = async (player: PlayerDefinition) => {
              const result = await openInSpecificPlayer(linkTarget, player)
              markAfterAcceptedHandoff({
                accepted: result.expectsNavigation,
                itemLabel: link.label,
                markOpened: () => actions.markOpened(item.url, linkTarget),
              })
            }

            return (
              <div
                key={linkKey}
                className="flex flex-col border-b last:border-b-0"
              >
                <div className="relative">
                  <button
                    type="button"
                    disabled={isExpired}
                    data-folder-state={
                      isFolder ? getFolderVisualState(link, false) : undefined
                    }
                    className={cn(
                      "flex min-h-24 w-full items-center gap-3 px-4 py-6 text-left",
                      !isExpired && "hover:bg-muted",
                      !isFolder && "pr-16",
                      link.opened &&
                        !isExpired &&
                        "bg-sky-500/15 hover:bg-sky-500/20",
                      isExpired &&
                        "cursor-not-allowed text-muted-foreground opacity-60"
                    )}
                    onClick={() => void openLink(link)}
                  >
                    <SaveListRowIcon
                      icon={isFolder ? getFolderIcon(link, false) : PlayIcon}
                      className={
                        isExpired ? "text-muted-foreground" : undefined
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <FilenameText
                        value={link.label}
                        className="block text-sm md:text-lg"
                        textClassName={isExpired ? "line-through" : undefined}
                      />
                      {!link.opened && !isExpired && (
                        <NewBadge className="mt-2 md:hidden" />
                      )}
                      {link.expiry !== undefined && (
                        <span className="mt-1 flex justify-end text-xs text-muted-foreground">
                          <PlayableExpiryBadge
                            expiresAt={link.expiry}
                            expirySource={link.expirySource}
                          />
                        </span>
                      )}
                    </span>
                    {link.size && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {link.size}
                      </span>
                    )}
                    {!link.opened && !isExpired && (
                      <NewBadge className="hidden md:inline-flex" />
                    )}
                    {isResolving ? (
                      <Spinner aria-label={`Loading ${link.label}…`} />
                    ) : isFolder ? (
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        className="shrink-0 text-foreground"
                      />
                    ) : null}
                  </button>
                  {!isFolder && !isResolving && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <LinkActionsDotMenu
                        itemLabel={link.label}
                        onCopyLink={copyLink}
                        onOpenInPlayer={openLinkInPlayer}
                        isPlayable={!isExpired}
                        className="size-9 shrink-0 text-foreground"
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export const SaveListBrowser = ({
  items,
  selectedItemUrl,
  onSelectedItemUrlChange,
  actions,
  extractingItems,
  highlightedId,
  isHydrating,
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
      />
    )
  }

  if (isHydrating) {
    return (
      <div
        className="flex min-h-56 items-center justify-center"
        role="status"
        aria-label="Loading saved links…"
      >
        <Spinner aria-hidden="true" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 text-center">
        <HugeiconsIcon
          icon={Archive04Icon}
          className="size-7 text-foreground"
        />
        <p className="font-medium">No saved links</p>
      </div>
    )
  }

  return (
    <section className="border-t">
      <div className="flex flex-col">
        {items.map((item) => {
          const itemKey = item.id ?? item.url
          const view = toLinkViewModel(item)
          const interactionState = getSavedLinkInteractionState(
            item,
            Date.now()
          )
          const { directLink, isDirectLinkExpired, isResolvableContainer } =
            interactionState
          const isExtracting = extractingItems.has(item.url)
          const isRootItemNew = interactionState.isNew

          if (directLink && isResolvableContainer) {
            const directLinkTarget = getMediaNodeTarget(directLink)
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
              className="border-b last:border-b-0"
              data-highlighted={highlightedId === item.id ? true : undefined}
            >
              <div
                className={cn(
                  "relative flex min-h-24 w-full items-center gap-0 px-4 py-6 md:gap-3",
                  !isDirectLinkExpired && "hover:bg-muted/70",
                  directLink?.opened &&
                    !isDirectLinkExpired &&
                    "bg-sky-500/15 hover:bg-sky-500/20"
                )}
              >
                <button
                  type="button"
                  disabled={isDirectLinkExpired}
                  aria-label={
                    directLink
                      ? `Open ${directLink.label || getItemTitle(item)}`
                      : `View ${getItemTitle(item)}`
                  }
                  className={cn(
                    "absolute inset-0 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    isDirectLinkExpired && "cursor-not-allowed"
                  )}
                  onClick={() => {
                    if (directLink) {
                      const directLinkTarget = getMediaNodeTarget(directLink)
                      void actions
                        .play(directLink)
                        .then((result) =>
                          markAfterAcceptedHandoff({
                            ...result,
                            itemLabel: directLink.label,
                            markOpened: () =>
                              actions.markOpened(item.url, directLinkTarget),
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
                    isDirectLinkExpired && "text-muted-foreground opacity-60"
                  )}
                >
                  {directLink ? (
                    <SaveListRowIcon
                      icon={PlayIcon}
                      className={
                        isDirectLinkExpired
                          ? "text-muted-foreground"
                          : undefined
                      }
                    />
                  ) : (
                    <SaveListRowIcon icon={Folder01Icon} />
                  )}
                  <span className="min-w-0 flex-1">
                    <FilenameText
                      value={directLink?.label || getItemTitle(item)}
                      className="block text-sm font-normal [&_button]:pointer-events-auto [&_button]:relative [&_button]:z-10 md:text-lg"
                      textClassName={
                        isDirectLinkExpired ? "line-through" : undefined
                      }
                    />
                    <span className="mt-1 flex min-w-0 flex-col items-start gap-1 text-xs text-muted-foreground md:flex-row md:items-center md:gap-1.5">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="min-w-0 truncate">
                          {view.sourceName || view.pluginName || item.url}
                        </span>
                        {directLink?.size && (
                          <span className="flex shrink-0 items-center gap-1.5">
                            <span aria-hidden="true">·</span>
                            <span>{directLink.size}</span>
                          </span>
                        )}
                      </span>
                      {!directLink && (
                        <span className="flex items-center gap-2 md:hidden">
                          <span className="md:hidden">
                            {view.extractedLinks.length} items
                          </span>
                          {isRootItemNew && <NewBadge className="md:hidden" />}
                        </span>
                      )}
                      {directLink &&
                        (isRootItemNew || directLink.expiry !== undefined) && (
                          <span className="flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-1.5">
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
                              <NewBadge className="md:hidden" />
                            )}
                          </span>
                        )}
                    </span>
                  </span>
                </div>
                {isRootItemNew && (
                  <NewBadge className="relative z-10 hidden md:inline-flex" />
                )}
                {!directLink && (
                  <span className="pointer-events-none relative z-10 hidden shrink-0 text-xs text-muted-foreground md:inline">
                    {view.extractedLinks.length} items
                  </span>
                )}
                <span className="relative z-10">
                  <LinkItemMenu
                    item={item}
                    actions={actions}
                    playableLink={directLink}
                    isPlayableLinkExpired={isDirectLinkExpired}
                    showRemove
                    isRefreshing={isExtracting}
                  />
                </span>
                {!directLink && !isExtracting && (
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="pointer-events-none relative z-10 shrink-0 text-foreground"
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

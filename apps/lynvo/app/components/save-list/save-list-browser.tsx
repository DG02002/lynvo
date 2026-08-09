import type { ComponentProps } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Archive04Icon,
  DashboardSquare03Icon,
  Folder01Icon,
  Folder02Icon,
  PackageIcon,
  PackageOpenIcon,
  PackageSearchIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "~/components/ui/button"
import {
  DraftLinkItemMenu,
  LinkItemMenu,
} from "~/components/links/LinkItemMenu"
import { LinkActionsDotMenu } from "~/components/links/LinkActionsContextMenu"
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
import { DraftExpiryBadge } from "~/components/save-list/draft-expiry-badge"
import { PlayableExpiryBadge } from "~/components/save-list/playable-expiry-badge"
import { NewBadge } from "~/components/save-list/new-badge"
import { FilenameText } from "~/components/filename-text"
import { getSavedLinkInteractionState } from "~/features/links/saved-link-interaction"
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

interface SaveListBrowserProps {
  items: LinkListItem[]
  selectedItemUrl: string | null
  onSelectedItemUrlChange: (url: string | null) => void
  actions: LinkItemActions
  extractingItems: Set<string>
  highlightedId: string | null
  isHydrating: boolean
  onAddLink?: () => void
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
    <HugeiconsIcon icon={icon} />
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
  ) =>
    folderLinks.flatMap((link) => {
      if (link.type !== "folder" || isMirrorResolvable(link)) {
        return []
      }
      const linkKey = getLinkKey(link)
      const path = [...parentPath, { id: linkKey, label: link.label }]
      const isCurrent = folderPath.at(-1)?.id === linkKey
      const isInPath = folderPath.some((folder) => folder.id === linkKey)

      return [
        <div key={linkKey} className="flex min-w-0 flex-col gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-auto min-h-9 w-full justify-start gap-2 whitespace-normal px-2 py-1.5 text-left text-sm font-normal transition-none hover:bg-accent hover:text-accent-foreground",
              isCurrent && "bg-accent text-accent-foreground"
            )}
            aria-current={isCurrent ? "page" : undefined}
            data-folder-state={getFolderVisualState(link, isInPath)}
            onClick={() => onSelectFolder(link, path)}
          >
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className={cn("shrink-0", isInPath && "rotate-90")}
            />
            <HugeiconsIcon
              icon={getFolderIcon(link, isInPath)}
              className="shrink-0"
            />
            <FilenameText value={link.label} className="w-0 min-w-0 flex-1" />
          </Button>
          {link.children?.some((child) => child.type === "folder") && (
            <div className="ml-5 flex min-w-0 flex-col gap-1">
              {renderFolders(link.children, path)}
            </div>
          )}
        </div>,
      ]
    })

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-auto min-h-9 w-full justify-start gap-2 whitespace-normal px-2 py-1.5 text-left text-sm font-normal transition-none hover:bg-accent hover:text-accent-foreground",
          folderPath.length === 0 && "bg-accent text-accent-foreground"
        )}
        aria-current={folderPath.length === 0 ? "page" : undefined}
        onClick={onSelectRoot}
      >
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          className={cn("shrink-0", folderPath.length > 0 && "rotate-90")}
        />
        <HugeiconsIcon icon={Folder02Icon} className="shrink-0" />
        <FilenameText value={rootLabel} className="w-0 min-w-0 flex-1" />
      </Button>
      <div className="ml-5 flex min-w-0 flex-col gap-1">
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
  <section className="h-svh overflow-hidden bg-background">
    <header className="flex h-16 items-center gap-3 border-b bg-background px-4 py-3">
      <Button
        variant="ghost"
        className="hover:bg-transparent hover:text-foreground"
        onClick={onExit}
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
        Back
      </Button>
      <h1 className="min-w-0 flex-1 line-clamp-2 break-words text-base font-normal md:text-xl">
        {getItemTitle(item)}
      </h1>
      <LinkItemMenu
        item={item}
        actions={actions}
        showRemove
        onRemoved={onExit}
        isRefreshing={extractingItems.has(item.url)}
      />
    </header>
    <div className="flex h-[calc(100svh-4rem)] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
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
    {mirrors.map((mirror) => (
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
        </Button>
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <LinkActionsDotMenu
            itemLabel={mirror.label}
            onCopyLink={() => void navigator.clipboard.writeText(mirror.url)}
            onOpenInPlayer={(player) => {
              actions.markOpened(itemUrl, sourceLink.url)
              void openInSpecificPlayer(mirror.url, player)
            }}
            className="size-9 shrink-0 text-foreground"
          />
        </div>
      </div>
    ))}
  </div>
)

const ResolvableContainerRow = ({
  item,
  link,
  actions,
  isResolving,
  onRemove,
}: ResolvableContainerRowProps) => {
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
            onCopyLink={() => void navigator.clipboard.writeText(link.url)}
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
  const {
    rootLinks,
    folderPath,
    currentLinks,
    contentRef,
    openFolder,
    openLink,
    selectRoot,
  } = useFinderBrowserState({ item, actions })

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
      <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4 py-3">
        <Button
          variant="ghost"
          className="hover:bg-transparent hover:text-foreground"
          onClick={onExit}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
          Back
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-2 break-words text-base font-normal md:text-xl">
            {getItemTitle(item)}
          </h1>
        </div>
        <LinkItemMenu
          item={item}
          actions={actions}
          showRemove
          onRemoved={onExit}
          isRefreshing={extractingItems.has(item.url)}
        />
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[16rem_minmax(0,1fr)] md:grid-rows-1">
        <aside className="min-w-0 overflow-x-hidden border-b p-3 md:border-r md:border-b-0">
          <FolderTree
            rootLabel={getItemTitle(item)}
            folderPath={folderPath}
            links={rootLinks}
            onSelectRoot={selectRoot}
            onSelectFolder={(link, path) => void openFolder(link, path)}
          />
        </aside>

        <div
          ref={contentRef}
          className="min-h-0 overflow-y-auto overscroll-contain p-2"
        >
          {currentLinks.map((link) => {
            const linkKey = getLinkKey(link)
            if (isMirrorResolvable(link)) {
              return (
                <ResolvableContainerRow
                  key={linkKey}
                  item={item}
                  link={link}
                  actions={actions}
                  isResolving={extractingItems.has(link.url)}
                  onRemove={() =>
                    actions.removeLink?.(item.url, linkKey, link.url)
                  }
                />
              )
            }
            const isFolder = link.type === "folder" || Boolean(link.children)
            const isExpired =
              !isFolder &&
              link.expiry !== undefined &&
              link.expiry <= Date.now()
            const isResolving = extractingItems.has(link.url)
            const copyLink = () => {
              void navigator.clipboard.writeText(link.url)
            }
            const openLinkInPlayer = (player: PlayerDefinition) => {
              actions.markOpened(item.url, link.url)
              void openInSpecificPlayer(link.url, player)
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
                        className={cn(
                          "block text-sm md:text-lg",
                          isExpired && "line-through"
                        )}
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
  onAddLink,
}: SaveListBrowserProps) => {
  const selectedItem = items.find((item) => item.url === selectedItemUrl)

  if (selectedItem) {
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
        <div className="flex flex-col gap-1">
          <p className="font-medium">No saved links</p>
          <p className="text-sm text-muted-foreground">
            Add a link to save it for later.
          </p>
        </div>
        {onAddLink && (
          <Button variant="outline" onClick={onAddLink}>
            Add a link
          </Button>
        )}
      </div>
    )
  }

  return (
    <section className="border-t">
      <div className="flex flex-col">
        {items.map((item) => {
          const isDraft = item.kind === "draft"
          const itemKey =
            item.kind === "saved" ? (item.id ?? item.url) : item.url
          const view =
            item.kind === "saved"
              ? toLinkViewModel(item)
              : {
                  extractedLinks:
                    item.extractedLinks ?? item.meta.extractedLinks ?? [],
                  sourceName: item.meta.sourceName,
                  pluginName: item.meta.pluginName,
                }
          const interactionState =
            item.kind === "saved"
              ? getSavedLinkInteractionState(item, Date.now())
              : {
                  directLink: undefined,
                  isDirectLinkExpired: false,
                  isNew: false,
                  isResolvableContainer: false,
                }
          const { directLink, isDirectLinkExpired, isResolvableContainer } =
            interactionState
          const isExtracting = extractingItems.has(item.url)
          const isRootItemNew = interactionState.isNew

          if (item.kind === "saved" && directLink && isResolvableContainer) {
            return (
              <ResolvableContainerRow
                key={itemKey}
                item={item}
                link={directLink}
                actions={actions}
                isResolving={extractingItems.has(directLink.url)}
                onRemove={() => actions.remove(item.url, item.id)}
              />
            )
          }

          return (
            <div
              key={itemKey}
              className="border-b last:border-b-0"
              data-highlighted={
                item.kind === "saved" && highlightedId === item.id
                  ? true
                  : undefined
              }
            >
              <div
                className={cn(
                  "flex min-h-24 w-full items-center gap-0 px-4 py-6 md:gap-3",
                  !isDirectLinkExpired && "hover:bg-muted/70",
                  directLink?.opened &&
                    !isDirectLinkExpired &&
                    "bg-sky-500/15 hover:bg-sky-500/20"
                )}
              >
                <button
                  type="button"
                  disabled={isDirectLinkExpired}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 text-left md:gap-3",
                    isDirectLinkExpired &&
                      "cursor-not-allowed text-muted-foreground opacity-60"
                  )}
                  onClick={() => {
                    if (isDraft) {
                      actions.showLinks(item.url)
                      return
                    }
                    if (directLink) {
                      actions.markOpened(item.url, directLink.url)
                      actions.play(directLink)
                      return
                    }
                    actions.markOpened(item.url, item.url)
                    onSelectedItemUrlChange(item.url)
                  }}
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
                  ) : isDraft ? (
                    <SaveListRowIcon icon={DashboardSquare03Icon} />
                  ) : (
                    <SaveListRowIcon icon={Folder01Icon} />
                  )}
                  <span className="min-w-0 flex-1">
                    <FilenameText
                      value={directLink?.label || getItemTitle(item)}
                      className={cn(
                        "block text-sm font-normal md:text-lg",
                        isDirectLinkExpired && "line-through"
                      )}
                    />
                    <span className="mt-1 flex min-w-0 flex-col items-start gap-1 text-xs text-muted-foreground md:flex-row md:items-center md:gap-1.5">
                      <span className="min-w-0 truncate">
                        {view.sourceName || view.pluginName || item.url}
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
                </button>
                {isRootItemNew && (
                  <NewBadge className="hidden md:inline-flex" />
                )}
                {!directLink && (
                  <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">
                    {view.extractedLinks.length} items
                  </span>
                )}
                {item.kind === "draft" && (
                  <DraftExpiryBadge expiresAt={item.expiresAt} />
                )}
                {item.kind === "draft" ? (
                  <DraftLinkItemMenu
                    item={item}
                    actions={actions}
                    playableLink={directLink}
                    isPlayableLinkExpired={isDirectLinkExpired}
                    showRemove
                    isRefreshing={isExtracting}
                  />
                ) : (
                  <LinkItemMenu
                    item={item}
                    actions={actions}
                    playableLink={directLink}
                    isPlayableLinkExpired={isDirectLinkExpired}
                    showRemove
                    isRefreshing={isExtracting}
                  />
                )}
                {!directLink && !isExtracting && (
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="shrink-0 text-foreground"
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

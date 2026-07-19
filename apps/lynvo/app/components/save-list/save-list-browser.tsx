import { useEffect, useMemo, useRef, useState } from "react"
import type { ComponentProps } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  DashboardSquare03Icon,
  Folder01Icon,
  Folder02Icon,
  FolderSymlinkIcon,
  Link01Icon,
  PackageIcon,
  PackageOpenIcon,
  PackageSearchIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "~/components/ui/button"
import { CardDotMenu } from "~/components/links/CardDotMenu"
import { LinkActionsDotMenu } from "~/components/links/LinkActionsContextMenu"
import { Spinner } from "~/components/ui/spinner"
import type { LinkCardActions } from "~/features/links/link-card-actions"
import type { ExtractedLink, RecentLinkViewItem } from "~/features/links/types"
import { toRecentLinkViewModel } from "~/features/links/link-view-models"
import { openInSpecificPlayer, type PlayerDefinition } from "~/lib/player-utils"
import { cn } from "~/lib/utils"
import { formatPlayableExpiry } from "~/features/links/format-playable-expiry"
import { ResolvableLinkMenu } from "~/components/save-list/resolvable-link-menu"
import { NewBadge } from "~/components/save-list/new-badge"
import { getRecentLinkViewItemMetadata } from "~/features/links/link-metadata-accessors"

interface SaveListBrowserProps {
  items: RecentLinkViewItem[]
  selectedItemUrl: string | null
  onSelectedItemUrlChange: (url: string | null) => void
  actions: LinkCardActions
  extractingItems: Set<string>
  highlightedId: string | null
  isHydrating: boolean
}

interface FolderLevel {
  id: string
  label: string
}

interface FinderBrowserProps {
  item: RecentLinkViewItem
  actions: LinkCardActions
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

const getLinkKey = (link: ExtractedLink) => link.id ?? link.url

const isLazyFolder = (link: ExtractedLink) =>
  link.type === "folder" &&
  !link.children?.length &&
  link.childrenResolved !== true

const getFolderVisualState = (link: ExtractedLink, isOpen: boolean) => {
  if (isOpen) {
    return "open"
  }
  return isLazyFolder(link) ? "lazy-closed" : "closed"
}

const getFolderIcon = (link: ExtractedLink, isOpen: boolean) => {
  const visualState = getFolderVisualState(link, isOpen)
  if (visualState === "open") {
    return Folder02Icon
  }
  return visualState === "lazy-closed" ? FolderSymlinkIcon : Folder01Icon
}

const getResolvableSourceName = (
  link: ExtractedLink,
  item: RecentLinkViewItem
) => {
  if (link.sourceName) {
    return link.sourceName
  }
  if (
    URL.canParse(link.url) &&
    new URL(link.url).hostname.toLowerCase().includes("hubcloud")
  ) {
    return "HubCloud"
  }
  const view = toRecentLinkViewModel(item)
  return view.sourceName || view.pluginName || item.url
}

const getItemTitle = (item: RecentLinkViewItem) =>
  toRecentLinkViewModel(item).title || new URL(item.url).hostname

const getLinksAtFolderPath = (
  rootLinks: ExtractedLink[],
  folderPath: FolderLevel[]
) =>
  folderPath.reduce<ExtractedLink[]>((currentLinks, folder) => {
    const currentFolder = currentLinks.find(
      (link) => getLinkKey(link) === folder.id
    )
    return currentFolder?.children ?? []
  }, rootLinks)

const SaveListRowIcon = ({
  icon,
}: {
  icon: ComponentProps<typeof HugeiconsIcon>["icon"]
}) => (
  <span className="flex size-14 shrink-0 items-center justify-center text-foreground">
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
    folderLinks
      .filter(
        (link) => link.type === "folder" && link.workerNodeKind !== "resolvable"
      )
      .map((link) => {
        const linkKey = getLinkKey(link)
        const path = [...parentPath, { id: linkKey, label: link.label }]
        const isCurrent = folderPath.at(-1)?.id === linkKey
        const isInPath = folderPath.some((folder) => folder.id === linkKey)

        return (
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
              <span className="min-w-0 flex-1 break-words">{link.label}</span>
            </Button>
            {link.children?.some((child) => child.type === "folder") && (
              <div className="ml-5 flex min-w-0 flex-col gap-1">
                {renderFolders(link.children, path)}
              </div>
            )}
          </div>
        )
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
        <span className="min-w-0 flex-1 break-words">{rootLabel}</span>
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
      <CardDotMenu
        item={item}
        actions={actions}
        showRemove
        onRemoved={onExit}
        isRefreshing={extractingItems.has(item.url)}
      />
    </header>
    <div className="flex h-[calc(100svh-4rem)] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <p className="text-sm text-muted-foreground">
        No saved files are available yet.
      </p>
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
  actions: LinkCardActions
}

interface ResolvableContainerRowProps {
  item: RecentLinkViewItem
  link: ExtractedLink
  actions: LinkCardActions
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
          <span className="min-w-0 flex-1 break-words text-sm md:text-lg">
            {mirror.label}
          </span>
        </Button>
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <LinkActionsDotMenu
            onCopyLink={() => void navigator.clipboard.writeText(mirror.url)}
            onOpenInPlayer={(player) => {
              actions.markWatched(itemUrl, sourceLink.url)
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
  const savedMirrors =
    getRecentLinkViewItemMetadata(item).playback.resolvedMirrors?.[link.url] ??
    []
  const [mirrors, setMirrors] = useState(() =>
    savedMirrors.filter((mirror) => mirror.status !== "down")
  )
  const [isExpanded, setIsExpanded] = useState(false)
  const [didResolutionFail, setDidResolutionFail] = useState(false)
  const displaySize = link.size || mirrors.find((mirror) => mirror.size)?.size

  const resolveLink = async (bypassCache = false) => {
    setDidResolutionFail(false)
    setIsExpanded(true)
    const resolvedLinks = await actions.expandMirror(
      item.url,
      link.url,
      bypassCache
    )
    const availableMirrors =
      resolvedLinks?.filter((mirror) => mirror.status !== "down") ?? []
    setMirrors(availableMirrors)
    if (!availableMirrors.length) {
      setIsExpanded(false)
      setDidResolutionFail(true)
    }
  }

  const openLink = () => {
    if (!link.watched) {
      actions.markWatched(item.url, link.url)
    }
    if (mirrors.length) {
      setIsExpanded((currentValue) => !currentValue)
      return
    }
    void resolveLink()
  }

  const resolutionState = isResolving
    ? "resolving"
    : didResolutionFail
      ? "failed"
      : mirrors.length > 0
        ? isExpanded
          ? "expanded"
          : "collapsed"
        : "unresolved"

  return (
    <div className="flex flex-col border-b last:border-b-0">
      <div className="relative">
        <button
          type="button"
          className={cn(
            "flex min-h-24 w-full items-center gap-3 px-4 py-6 pr-16 text-left",
            "hover:bg-muted",
            link.watched && "bg-sky-500/15 hover:bg-sky-500/20",
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
            <span className="block line-clamp-3 break-words text-sm md:text-lg">
              {link.label}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {getResolvableSourceName(link, item)}
            </span>
          </span>
          {Boolean(displaySize) && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {displaySize}
            </span>
          )}
          {!link.watched && <NewBadge />}
          {isResolving ? (
            <Spinner />
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
            onCopyLink={() => void navigator.clipboard.writeText(link.url)}
            onRefresh={() => {
              setMirrors([])
              void resolveLink(true)
            }}
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
  const itemRootLinks = useMemo(
    () => toRecentLinkViewModel(item).extractedLinks,
    [item]
  )
  const [rootLinks, setRootLinks] = useState(itemRootLinks)
  const [folderPath, setFolderPath] = useState<FolderLevel[]>([])
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollPositionsRef = useRef(new Map<string, number>())
  const currentLinks = useMemo(
    () => getLinksAtFolderPath(rootLinks, folderPath),
    [folderPath, rootLinks]
  )
  const currentFolderKey = folderPath.at(-1)?.id ?? item.url

  useEffect(() => {
    setRootLinks(itemRootLinks)
  }, [itemRootLinks])

  useEffect(() => {
    contentRef.current?.scrollTo({
      top: scrollPositionsRef.current.get(currentFolderKey) ?? 0,
    })
  }, [currentFolderKey])

  const rememberScrollPosition = () => {
    scrollPositionsRef.current.set(
      currentFolderKey,
      contentRef.current?.scrollTop ?? 0
    )
  }

  const openFolder = async (link: ExtractedLink, targetPath: FolderLevel[]) => {
    const linkKey = getLinkKey(link)
    actions.markWatched(item.url, link.url)
    if (!link.children?.length && link.childrenResolved !== true) {
      const resolvedLinks = await actions.expandFolder(
        item.url,
        linkKey,
        link.url
      )
      if (!resolvedLinks) {
        return
      }
      setRootLinks(resolvedLinks)
    }
    rememberScrollPosition()
    setFolderPath(targetPath)
  }

  const openLink = async (link: ExtractedLink) => {
    const linkKey = getLinkKey(link)
    if (link.type === "folder" || link.children?.length) {
      await openFolder(link, [
        ...folderPath,
        { id: linkKey, label: link.label },
      ])
      return
    }

    actions.markWatched(item.url, link.url)
    actions.play(link)
  }

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
        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-2 break-words text-base font-normal md:text-xl">
            {getItemTitle(item)}
          </h1>
        </div>
        <CardDotMenu
          item={item}
          actions={actions}
          showRemove
          onRemoved={onExit}
          isRefreshing={extractingItems.has(item.url)}
        />
      </header>

      <div className="grid h-[calc(100svh-4rem)] md:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="border-b p-3 md:border-r md:border-b-0">
          <FolderTree
            rootLabel={getItemTitle(item)}
            folderPath={folderPath}
            links={rootLinks}
            onSelectRoot={() => {
              rememberScrollPosition()
              setFolderPath([])
            }}
            onSelectFolder={(link, path) => void openFolder(link, path)}
          />
        </aside>

        <div
          ref={contentRef}
          className="h-[calc(100svh-4rem)] overflow-y-auto overscroll-contain p-2"
        >
          {currentLinks.map((link) => {
            const linkKey = getLinkKey(link)
            const isResolvable = link.workerNodeKind === "resolvable"
            if (isResolvable) {
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
            const isResolving = extractingItems.has(link.url)
            const copyLink = () => {
              void navigator.clipboard.writeText(link.url)
            }
            const openLinkInPlayer = (player: PlayerDefinition) => {
              actions.markWatched(item.url, link.url)
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
                    data-folder-state={
                      isFolder ? getFolderVisualState(link, false) : undefined
                    }
                    className={cn(
                      "flex min-h-24 w-full items-center gap-3 px-4 py-6 text-left",
                      "hover:bg-muted",
                      !isFolder && "pr-16",
                      link.watched && "bg-sky-500/15 hover:bg-sky-500/20"
                    )}
                    onClick={() => void openLink(link)}
                  >
                    <SaveListRowIcon
                      icon={isFolder ? getFolderIcon(link, false) : PlayIcon}
                    />
                    <span className="min-w-0 flex-1 line-clamp-3 break-words text-sm md:text-lg">
                      {link.label}
                    </span>
                    {link.size && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {link.size}
                      </span>
                    )}
                    {!link.watched && <NewBadge />}
                    {link.expiry && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatPlayableExpiry(link.expiry)}
                      </span>
                    )}
                    {isResolving ? (
                      <Spinner />
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
                        onCopyLink={copyLink}
                        onOpenInPlayer={openLinkInPlayer}
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
        aria-label="Loading saved links"
      >
        <Spinner />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 text-center">
        <HugeiconsIcon
          icon={Link01Icon}
          className="size-7 text-muted-foreground"
        />
        <div className="flex flex-col gap-1">
          <p className="font-medium">No saved links</p>
          <p className="text-sm text-muted-foreground">
            Paste a link above and it will appear here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <section className="border-t">
      <div className="flex flex-col">
        {items.map((item) => {
          const itemKey = item.id ?? item.url
          const view = toRecentLinkViewModel(item)
          const directLink =
            !item.isDraft &&
            view.extractedLinks.length === 1 &&
            (view.extractedLinks[0]?.type !== "folder" ||
              view.extractedLinks[0]?.workerNodeKind === "resolvable")
              ? view.extractedLinks[0]
              : undefined
          const isResolvableContainer =
            directLink?.workerNodeKind === "resolvable"
          const isExtracting = extractingItems.has(item.url)
          const isRootFolderNew =
            !directLink &&
            !item.isDraft &&
            !new Set(
              getRecentLinkViewItemMetadata(item).playback.watchedUrls
            ).has(item.url)

          if (directLink && isResolvableContainer) {
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
              data-highlighted={highlightedId === item.id || undefined}
            >
              <div
                className={cn(
                  "flex min-h-24 w-full items-center gap-3 px-4 py-6",
                  "hover:bg-muted/70",
                  directLink?.watched && "bg-sky-500/15 hover:bg-sky-500/20"
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => {
                    if (item.isDraft) {
                      actions.showLinks(item.url)
                      return
                    }
                    if (directLink) {
                      actions.markWatched(item.url, directLink.url)
                      actions.play(directLink)
                      return
                    }
                    actions.markWatched(item.url, item.url)
                    onSelectedItemUrlChange(item.url)
                  }}
                >
                  {directLink ? (
                    <SaveListRowIcon icon={PlayIcon} />
                  ) : item.isDraft ? (
                    <SaveListRowIcon icon={DashboardSquare03Icon} />
                  ) : (
                    <SaveListRowIcon icon={Folder01Icon} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block line-clamp-3 break-words text-sm font-normal md:text-lg">
                      {directLink?.label || getItemTitle(item)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {view.sourceName || view.pluginName || item.url}
                    </span>
                  </span>
                </button>
                {(directLink ? !directLink.watched : isRootFolderNew) && (
                  <NewBadge />
                )}
                {!directLink && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {view.extractedLinks.length} items
                  </span>
                )}
                {directLink?.expiry && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatPlayableExpiry(directLink.expiry)}
                  </span>
                )}
                <CardDotMenu
                  item={item}
                  actions={actions}
                  isDraft={item.isDraft}
                  playableLink={directLink}
                  showRemove
                  isRefreshing={isExtracting}
                />
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

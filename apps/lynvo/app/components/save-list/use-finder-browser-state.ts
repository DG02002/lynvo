import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  useBlocker,
  useLocation,
  useNavigate,
  useNavigationType,
  type BlockerFunction,
} from "react-router"
import { toLinkViewModel } from "~/features/links/link-view-models"
import type { ExtractedLink, LinkViewItem } from "~/features/links/types"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import {
  getMediaNodeInteractionState,
  getMediaNodeTargetOrUndefined,
} from "~/features/links/media-node-interaction"
import {
  getLinkKey,
  getLinksAtFolderPath,
  resolveFolderPath,
  type FolderLevel,
} from "./save-list-browser-model"
import { markAfterAcceptedHandoff } from "~/lib/opened-confirmation-events"
import { useFinderScrollRestoration } from "./use-finder-scroll-restoration"
import { useFinderWheelNavigation } from "./use-finder-wheel-navigation"
import { createFolderPathSearch, parseFolderPath } from "./folder-path-url"
import { savePaths } from "~/lib/paths"
import {
  areFolderIdsEqual,
  useFinderFolderHistory,
} from "./use-finder-folder-history"

interface UseFinderBrowserStateOptions {
  item: LinkViewItem
  actions: LinkItemActions
  onExit: () => void
}

const getFolderScrollStorageKey = (savedLinkId: string) =>
  `lynvo:save-folder-scroll:${savedLinkId}`

const getLegacyFolderPathStorageKey = (savedLinkId: string) =>
  `lynvo:save-folder-path:${savedLinkId}`

const areFolderPathsEqual = (
  firstPath: FolderLevel[],
  secondPath: FolderLevel[]
) =>
  firstPath.length === secondPath.length &&
  firstPath.every(
    (folder, index) =>
      folder.id === secondPath[index]?.id &&
      folder.label === secondPath[index]?.label
  )

const isFolderPathResolutionPending = (
  item: LinkViewItem,
  itemRootLinks: ExtractedLink[],
  folderIds: string[]
) =>
  folderIds.length > 0 &&
  itemRootLinks.length === 0 &&
  (item.extractionStatus?.state === "queued" ||
    item.extractionStatus?.state === "running")

// Saved links are often wrappers ("New" > "Show S01" > episodes): descend
// through single-folder levels so the view opens on real content. A node
// qualifies through canExpand (folder with loaded children); mirror-classified
// resolvables with children are still navigable content.
const getSingleFolderDescendPath = (links: ExtractedLink[]): FolderLevel[] => {
  const descendedPath: FolderLevel[] = []
  let currentLinks = links
  while (currentLinks.length === 1) {
    const [onlyLink] = currentLinks
    if (onlyLink === undefined) {
      break
    }
    if (!getMediaNodeInteractionState(onlyLink).canExpand) {
      break
    }
    descendedPath.push({ id: getLinkKey(onlyLink), label: onlyLink.label })
    currentLinks = onlyLink.children ?? []
  }
  return descendedPath
}

export const useFinderBrowserState = ({
  item,
  actions,
  onExit,
}: UseFinderBrowserStateOptions) => {
  const itemRootLinks = useMemo(
    () => toLinkViewModel(item).extractedLinks,
    [item]
  )
  const location = useLocation()
  const navigate = useNavigate()
  const navigationType = useNavigationType()
  const currentLocationKeyRef = useRef(location.key)
  currentLocationKeyRef.current = location.key
  const isMountedRef = useRef(true)
  const folderOpenRequestRef = useRef(0)
  const parsedFolderPath = useMemo(
    () => parseFolderPath(location.search),
    [location.search]
  )
  const [rootLinks, setRootLinks] = useState(() => itemRootLinks)
  const initialFolderPath = useMemo(
    () =>
      parsedFolderPath.hasSearchParam
        ? resolveFolderPath(itemRootLinks, parsedFolderPath.ids)
        : getSingleFolderDescendPath(itemRootLinks),
    [itemRootLinks, parsedFolderPath]
  )
  const [folderPath, setFolderPath] = useState<FolderLevel[]>(initialFolderPath)
  const [forwardFolderPaths, setForwardFolderPaths] = useState<FolderLevel[][]>(
    []
  )
  const contentRef = useRef<HTMLDivElement>(null)
  const shouldAutoDescendRef = useRef(
    !parsedFolderPath.hasSearchParam && initialFolderPath.length > 0
  )
  const {
    previousFolderIds,
    forwardFolderIds: historyForwardFolderIds,
    hasBrowserForwardEntry,
  } = useFinderFolderHistory({
    locationKey: location.key,
    navigationType,
    folderIds: parsedFolderPath.ids,
  })

  const urlFolderPath = useMemo(
    () => resolveFolderPath(rootLinks, parsedFolderPath.ids),
    [parsedFolderPath.ids, rootLinks]
  )
  const visibleFolderPath = parsedFolderPath.hasSearchParam
    ? urlFolderPath
    : folderPath
  const currentLinks = useMemo(
    () => getLinksAtFolderPath(rootLinks, visibleFolderPath),
    [rootLinks, visibleFolderPath]
  )
  const currentFolderKey = visibleFolderPath.at(-1)?.id ?? item.url

  const { rememberScrollPosition } = useFinderScrollRestoration({
    contentRef,
    currentFolderKey,
    storageKey: item.id ? getFolderScrollStorageKey(item.id) : undefined,
  })

  const navigateToFolderPath = useEffectEvent(
    (nextFolderPath: FolderLevel[], replace: boolean) => {
      setFolderPath(nextFolderPath)
      const nextSearch = createFolderPathSearch(location.search, nextFolderPath)
      if (nextSearch === location.search) {
        return
      }
      void navigate(
        {
          pathname: location.pathname,
          search: nextSearch,
          hash: location.hash,
        },
        { preventScrollReset: true, replace }
      )
    }
  )

  // The URL is authoritative for a deep link and for browser POP navigations.
  // The local state only covers the initial auto-descended view before its
  // replace navigation has committed.
  useEffect(() => {
    if (parsedFolderPath.hasSearchParam) {
      if (
        isFolderPathResolutionPending(item, itemRootLinks, parsedFolderPath.ids)
      ) {
        return
      }
      setFolderPath((currentFolderPath) =>
        areFolderPathsEqual(currentFolderPath, urlFolderPath)
          ? currentFolderPath
          : urlFolderPath
      )
      return
    }

    if (shouldAutoDescendRef.current) {
      return
    }

    setFolderPath((currentFolderPath) =>
      currentFolderPath.length === 0 ? currentFolderPath : []
    )
  }, [item, itemRootLinks, parsedFolderPath, rootLinks, urlFolderPath])

  useEffect(() => {
    if (!parsedFolderPath.hasSearchParam && !shouldAutoDescendRef.current) {
      const descendedPath = getSingleFolderDescendPath(itemRootLinks)
      if (descendedPath.length > 0) {
        setFolderPath((currentFolderPath) => {
          if (currentFolderPath.length > 0) {
            return currentFolderPath
          }
          shouldAutoDescendRef.current = true
          return descendedPath
        })
      }
    }
    setRootLinks(itemRootLinks)
  }, [itemRootLinks])

  useEffect(() => {
    if (parsedFolderPath.hasSearchParam) {
      if (
        isFolderPathResolutionPending(item, itemRootLinks, parsedFolderPath.ids)
      ) {
        return
      }

      navigateToFolderPath(urlFolderPath, true)
      return
    }

    if (!shouldAutoDescendRef.current || folderPath.length === 0) {
      return
    }
    shouldAutoDescendRef.current = false
    navigateToFolderPath(folderPath, true)
  }, [folderPath, item, itemRootLinks, parsedFolderPath, urlFolderPath])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!item.id || globalThis.window === undefined) {
      return
    }
    try {
      window.sessionStorage.removeItem(getLegacyFolderPathStorageKey(item.id))
    } catch {
      // A blocked browser cache should not affect navigation.
    }
  }, [item.id])

  const prepareParentNavigation = (currentFolderPath: FolderLevel[]) => {
    const parentFolderPath = currentFolderPath.slice(0, -1)
    rememberScrollPosition()
    setForwardFolderPaths((currentForwardFolderPaths) => [
      currentFolderPath,
      ...currentForwardFolderPaths,
    ])
    shouldAutoDescendRef.current = false
    return parentFolderPath
  }

  const navigateToParentFolder = () => {
    if (visibleFolderPath.length === 0) {
      onExit()
      return
    }
    const parentFolderPath = prepareParentNavigation(visibleFolderPath)

    const parentFolderIds = parentFolderPath.map((folder) => folder.id)
    if (
      previousFolderIds &&
      areFolderIdsEqual(previousFolderIds, parentFolderIds)
    ) {
      setFolderPath(parentFolderPath)
      void navigate(-1)
      return
    }

    navigateToFolderPath(parentFolderPath, true)
  }

  const shouldBlockFolderExit = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation, historyAction }) =>
      historyAction === "POP" &&
      visibleFolderPath.length > 0 &&
      currentLocation.pathname.startsWith(savePaths.folderPrefix) &&
      nextLocation.pathname !== currentLocation.pathname,
    [visibleFolderPath.length]
  )
  const folderExitBlocker = useBlocker(shouldBlockFolderExit)
  const handleBlockedFolderExit = useEffectEvent(() => {
    if (folderExitBlocker.state !== "blocked") {
      return
    }
    const parentFolderPath = prepareParentNavigation(visibleFolderPath)
    folderExitBlocker.reset()
    navigateToFolderPath(parentFolderPath, true)
  })

  useEffect(() => {
    if (folderExitBlocker.state === "blocked") {
      handleBlockedFolderExit()
    }
  }, [folderExitBlocker.state])

  const navigateToNextFolder = () => {
    if (historyForwardFolderIds) {
      rememberScrollPosition()
      setForwardFolderPaths((currentForwardFolderPaths) =>
        currentForwardFolderPaths.slice(1)
      )
      const nextFolderPath = resolveFolderPath(
        rootLinks,
        historyForwardFolderIds
      )
      if (nextFolderPath.length === historyForwardFolderIds.length) {
        setFolderPath(nextFolderPath)
      }
      void navigate(1)
      return
    }

    if (hasBrowserForwardEntry && visibleFolderPath.length > 0) {
      rememberScrollPosition()
      void navigate(1)
      return
    }

    const [nextFolderPath] = forwardFolderPaths
    if (!nextFolderPath) {
      return
    }
    rememberScrollPosition()
    setForwardFolderPaths((currentForwardFolderPaths) =>
      currentForwardFolderPaths.slice(1)
    )
    navigateToFolderPath(nextFolderPath, false)
  }

  const hasNoRootLinks = rootLinks.length === 0
  const { resetHorizontalGesture } = useFinderWheelNavigation({
    contentRef,
    hasForwardFolderPaths:
      forwardFolderPaths.length > 0 ||
      historyForwardFolderIds !== undefined ||
      (hasBrowserForwardEntry && visibleFolderPath.length > 0),
    hasNoRootLinks,
    navigateToParentFolder,
    navigateToNextFolder,
  })

  const openFolder = async (link: ExtractedLink, targetPath: FolderLevel[]) => {
    const folderOpenRequest = ++folderOpenRequestRef.current
    const openedFromLocationKey = currentLocationKeyRef.current
    resetHorizontalGesture()
    const linkKey = getLinkKey(link)
    const linkTarget = getMediaNodeTargetOrUndefined(link)
    if (linkTarget !== undefined) {
      actions.markOpened(item.url, linkTarget)
    }
    if (
      getMediaNodeInteractionState(link).needsResolution &&
      linkTarget !== undefined
    ) {
      const resolvedLinks = await actions.expandFolder(
        item.url,
        linkKey,
        linkTarget
      )
      if (
        !resolvedLinks ||
        !isMountedRef.current ||
        folderOpenRequest !== folderOpenRequestRef.current ||
        openedFromLocationKey !== currentLocationKeyRef.current
      ) {
        return
      }
      setRootLinks(resolvedLinks)
    }
    setForwardFolderPaths([])
    rememberScrollPosition()
    shouldAutoDescendRef.current = false
    navigateToFolderPath(targetPath, false)
  }

  const openLink = async (link: ExtractedLink) => {
    const linkKey = getLinkKey(link)
    if (getMediaNodeInteractionState(link).isFolder) {
      await openFolder(link, [
        ...visibleFolderPath,
        { id: linkKey, label: link.label },
      ])
      return
    }

    const linkTarget = getMediaNodeTargetOrUndefined(link)
    const result = await actions.play(link)
    markAfterAcceptedHandoff({
      ...result,
      itemLabel: link.label,
      markOpened: () => {
        if (linkTarget !== undefined) {
          actions.markOpened(item.url, linkTarget)
        }
      },
    })
  }

  const handleEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented) {
      return
    }
    event.preventDefault()
    navigateToParentFolder()
  })

  useEffect(() => {
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [])

  return {
    rootLinks,
    folderPath: visibleFolderPath,
    currentLinks,
    contentRef,
    openFolder,
    openLink,
    navigateToParentFolder,
    selectRoot: () => {
      resetHorizontalGesture()
      setForwardFolderPaths([])
      rememberScrollPosition()
      shouldAutoDescendRef.current = false
      navigateToFolderPath([], true)
    },
  }
}

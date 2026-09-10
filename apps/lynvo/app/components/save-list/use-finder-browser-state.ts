import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate, useNavigationType } from "react-router"
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
  type FolderLevel,
} from "./save-list-browser-model"
import { markAfterAcceptedHandoff } from "~/lib/opened-confirmation-events"
import { useFinderScrollRestoration } from "./use-finder-scroll-restoration"
import { useFinderWheelNavigation } from "./use-finder-wheel-navigation"
import {
  createFolderPathSearch,
  parseFolderPath,
  resolveFolderPath,
} from "./folder-path-url"

interface UseFinderBrowserStateOptions {
  item: LinkViewItem
  actions: LinkItemActions
  onExit: () => void
}

const getFolderScrollStorageKey = (savedLinkId: string) =>
  `lynvo:save-folder-scroll:${savedLinkId}`

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

const areFolderIdsEqual = (firstIds: string[], secondIds: string[]) =>
  firstIds.length === secondIds.length &&
  firstIds.every((id, index) => id === secondIds[index])

interface FolderHistoryEntry {
  key: string
  folderIds: string[]
}

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
  const folderHistoryEntriesRef = useRef<FolderHistoryEntry[]>([
    { key: location.key, folderIds: parsedFolderPath.ids },
  ])
  const currentHistoryKeyRef = useRef(location.key)
  const [historyRevision, setHistoryRevision] = useState(0)

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

  const historyForwardFolderIds = useMemo(() => {
    const entries = folderHistoryEntriesRef.current
    const currentIndex = entries.findIndex(
      (entry) => entry.key === location.key
    )
    return currentIndex === -1
      ? undefined
      : entries[currentIndex + 1]?.folderIds
  }, [historyRevision, location.key])

  // The URL is authoritative for a deep link and for browser POP navigations.
  // The local state only covers the initial auto-descended view before its
  // replace navigation has committed.
  useEffect(() => {
    if (parsedFolderPath.hasSearchParam) {
      const isExtractionPending =
        item.extractionStatus?.state === "queued" ||
        item.extractionStatus?.state === "running"
      if (
        parsedFolderPath.ids.length > 0 &&
        itemRootLinks.length === 0 &&
        isExtractionPending
      ) {
        return
      }
      const resolvedPath = resolveFolderPath(rootLinks, parsedFolderPath.ids)
      setFolderPath((currentFolderPath) =>
        areFolderPathsEqual(currentFolderPath, resolvedPath)
          ? currentFolderPath
          : resolvedPath
      )
      return
    }

    if (shouldAutoDescendRef.current) {
      return
    }

    setFolderPath((currentFolderPath) =>
      currentFolderPath.length === 0 ? currentFolderPath : []
    )
  }, [item.extractionStatus?.state, itemRootLinks, parsedFolderPath, rootLinks])

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
    const entries = folderHistoryEntriesRef.current
    const currentEntry = {
      key: location.key,
      folderIds: parsedFolderPath.ids,
    }
    const previousIndex = entries.findIndex(
      (entry) => entry.key === currentHistoryKeyRef.current
    )

    if (navigationType === "PUSH") {
      const nextIndex =
        previousIndex === -1 ? entries.length : previousIndex + 1
      entries.splice(nextIndex)
      entries.push(currentEntry)
    } else if (navigationType === "REPLACE") {
      if (previousIndex === -1) {
        entries.splice(0, entries.length, currentEntry)
      } else {
        entries[previousIndex] = currentEntry
      }
    } else if (!entries.some((entry) => entry.key === location.key)) {
      entries.splice(0, entries.length, currentEntry)
    }

    currentHistoryKeyRef.current = location.key
    setHistoryRevision((revision) => revision + 1)
  }, [location.key, navigationType, parsedFolderPath.ids])

  useEffect(() => {
    if (parsedFolderPath.hasSearchParam) {
      const isExtractionPending =
        item.extractionStatus?.state === "queued" ||
        item.extractionStatus?.state === "running"
      if (
        parsedFolderPath.ids.length > 0 &&
        itemRootLinks.length === 0 &&
        isExtractionPending
      ) {
        return
      }

      const normalizedSearch = createFolderPathSearch(
        location.search,
        urlFolderPath
      )
      if (normalizedSearch === location.search) {
        return
      }
      void navigate(
        {
          pathname: location.pathname,
          search: normalizedSearch,
          hash: location.hash,
        },
        { preventScrollReset: true, replace: true }
      )
      return
    }

    if (!shouldAutoDescendRef.current || folderPath.length === 0) {
      return
    }
    shouldAutoDescendRef.current = false
    const normalizedSearch = createFolderPathSearch(location.search, folderPath)
    void navigate(
      {
        pathname: location.pathname,
        search: normalizedSearch,
        hash: location.hash,
      },
      { preventScrollReset: true, replace: true }
    )
  }, [
    folderPath,
    item.extractionStatus?.state,
    itemRootLinks.length,
    location.hash,
    location.pathname,
    location.search,
    navigate,
    parsedFolderPath,
    urlFolderPath,
  ])

  const { rememberScrollPosition } = useFinderScrollRestoration({
    contentRef,
    currentFolderKey,
    storageKey: item.id ? getFolderScrollStorageKey(item.id) : undefined,
  })

  const navigateToFolderPath = (
    nextFolderPath: FolderLevel[],
    replace: boolean
  ) => {
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

  const navigateToParentFolder = () => {
    if (visibleFolderPath.length === 0) {
      onExit()
      return
    }
    const parentFolderPath = visibleFolderPath.slice(0, -1)
    const previousFolderPath = visibleFolderPath
    rememberScrollPosition()
    setForwardFolderPaths((currentForwardFolderPaths) => [
      previousFolderPath,
      ...currentForwardFolderPaths,
    ])
    shouldAutoDescendRef.current = false

    const currentHistoryIndex = folderHistoryEntriesRef.current.findIndex(
      (entry) => entry.key === location.key
    )
    const previousHistoryEntry =
      currentHistoryIndex > 0
        ? folderHistoryEntriesRef.current[currentHistoryIndex - 1]
        : undefined
    const parentFolderIds = parentFolderPath.map((folder) => folder.id)
    if (
      previousHistoryEntry &&
      areFolderIdsEqual(previousHistoryEntry.folderIds, parentFolderIds)
    ) {
      setFolderPath(parentFolderPath)
      void navigate(-1)
      return
    }

    navigateToFolderPath(parentFolderPath, true)
  }

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
      forwardFolderPaths.length > 0 || historyForwardFolderIds !== undefined,
    hasNoRootLinks,
    navigateToParentFolder,
    navigateToNextFolder,
  })

  const openFolder = async (link: ExtractedLink, targetPath: FolderLevel[]) => {
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
      if (!resolvedLinks) {
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

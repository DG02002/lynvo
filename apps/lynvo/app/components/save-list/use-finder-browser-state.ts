import { useEffect, useMemo, useRef, useState } from "react"
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
  isMirrorResolvable,
  type FolderLevel,
} from "./save-list-browser-model"
import { markAfterAcceptedHandoff } from "~/lib/opened-confirmation-events"
import { useFinderScrollRestoration } from "./use-finder-scroll-restoration"
import { useFinderWheelNavigation } from "./use-finder-wheel-navigation"
import { Result, Schema } from "effect"

interface UseFinderBrowserStateOptions {
  item: LinkViewItem
  actions: LinkItemActions
  onExit: () => void
}

const getFolderPathStorageKey = (savedLinkId: string) =>
  `lynvo:save-folder-path:${savedLinkId}`

const storedFolderPathSchema = Schema.Array(
  Schema.Struct({ id: Schema.String })
)

const restoreFolderPath = (
  savedLinkId: string | undefined,
  rootLinks: ExtractedLink[]
): FolderLevel[] => {
  if (!savedLinkId || globalThis.window === undefined) {
    return []
  }

  try {
    const value = Schema.decodeUnknownResult(storedFolderPathSchema)(
      JSON.parse(
        window.sessionStorage.getItem(getFolderPathStorageKey(savedLinkId)) ??
          "[]"
      )
    )
    if (Result.isFailure(value)) {
      return []
    }

    const restoredPath: FolderLevel[] = []
    let links = rootLinks
    for (const level of value.success) {
      const folder = links.find((link) => getLinkKey(link) === level.id)
      if (!folder || !getMediaNodeInteractionState(folder).isFolder) {
        break
      }
      restoredPath.push({ id: level.id, label: folder.label })
      links = folder.children ?? []
    }
    return restoredPath
  } catch {
    return []
  }
}

// Saved links are often wrappers ("New" > "Show S01" > episodes): descend
// through single-folder levels so the view opens on real content.
const getSingleFolderDescendPath = (links: ExtractedLink[]): FolderLevel[] => {
  const descendedPath: FolderLevel[] = []
  let currentLinks = links
  while (currentLinks.length === 1) {
    const [onlyLink] = currentLinks
    if (
      onlyLink === undefined ||
      isMirrorResolvable(onlyLink) ||
      !getMediaNodeInteractionState(onlyLink).isFolder
    ) {
      break
    }
    const children = onlyLink.children ?? []
    if (children.length === 0) {
      break
    }
    descendedPath.push({ id: getLinkKey(onlyLink), label: onlyLink.label })
    currentLinks = children
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
  const [rootLinks, setRootLinks] = useState(() => itemRootLinks)
  const [folderPath, setFolderPath] = useState<FolderLevel[]>(() => {
    const restoredFolderPath = restoreFolderPath(item.id, itemRootLinks)
    if (restoredFolderPath.length > 0) {
      return restoredFolderPath
    }
    return getSingleFolderDescendPath(itemRootLinks)
  })
  const [forwardFolderPaths, setForwardFolderPaths] = useState<FolderLevel[][]>(
    []
  )
  const contentRef = useRef<HTMLDivElement>(null)
  const currentLinks = useMemo(
    () => getLinksAtFolderPath(rootLinks, folderPath),
    [folderPath, rootLinks]
  )
  const currentFolderKey = folderPath.at(-1)?.id ?? item.url
  const previousRootLinksLengthRef = useRef(itemRootLinks.length)

  useEffect(() => {
    const didRootLinksPopulate =
      previousRootLinksLengthRef.current === 0 && itemRootLinks.length > 0
    previousRootLinksLengthRef.current = itemRootLinks.length
    if (didRootLinksPopulate) {
      setFolderPath((currentFolderPath) =>
        currentFolderPath.length > 0
          ? currentFolderPath
          : getSingleFolderDescendPath(itemRootLinks)
      )
    }
    setRootLinks(itemRootLinks)
  }, [itemRootLinks])

  useEffect(() => {
    if (!item.id || globalThis.window === undefined) {
      return
    }
    window.sessionStorage.setItem(
      getFolderPathStorageKey(item.id),
      JSON.stringify(folderPath)
    )
  }, [folderPath, item.id])

  const { rememberScrollPosition } = useFinderScrollRestoration({
    contentRef,
    currentFolderKey,
  })

  const navigateToParentFolder = () => {
    if (folderPath.length === 0) {
      onExit()
      return
    }
    const previousFolderPath = folderPath
    rememberScrollPosition()
    setForwardFolderPaths((currentForwardFolderPaths) => [
      previousFolderPath,
      ...currentForwardFolderPaths,
    ])
    setFolderPath((currentFolderPath) => currentFolderPath.slice(0, -1))
  }

  const navigateToNextFolder = () => {
    const [nextFolderPath] = forwardFolderPaths
    if (!nextFolderPath) {
      return
    }
    rememberScrollPosition()
    setForwardFolderPaths((currentForwardFolderPaths) =>
      currentForwardFolderPaths.slice(1)
    )
    setFolderPath(nextFolderPath)
  }

  const hasNoRootLinks = rootLinks.length === 0
  const { resetHorizontalGesture } = useFinderWheelNavigation({
    contentRef,
    hasForwardFolderPaths: forwardFolderPaths.length > 0,
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
    setFolderPath(targetPath)
  }

  const openLink = async (link: ExtractedLink) => {
    const linkKey = getLinkKey(link)
    if (getMediaNodeInteractionState(link).isFolder) {
      await openFolder(link, [
        ...folderPath,
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

  return {
    rootLinks,
    folderPath,
    currentLinks,
    contentRef,
    openFolder,
    openLink,
    selectRoot: () => {
      resetHorizontalGesture()
      setForwardFolderPaths([])
      rememberScrollPosition()
      setFolderPath([])
    },
  }
}

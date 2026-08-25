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
  type FolderLevel,
} from "./save-list-browser-model"
import { markAfterAcceptedHandoff } from "~/lib/opened-confirmation-events"
import {
  FINDER_NAVIGATION_GESTURE_RESET_DELAY_MS,
  FINDER_NAVIGATION_GESTURE_TRIGGER_DISTANCE_PX,
} from "~/lib/constants"
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
  const [folderPath, setFolderPath] = useState<FolderLevel[]>(() =>
    restoreFolderPath(item.id, itemRootLinks)
  )
  const [forwardFolderPaths, setForwardFolderPaths] = useState<FolderLevel[][]>(
    []
  )
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollPositionsRef = useRef(new Map<string, number>())
  const horizontalGestureDistanceRef = useRef(0)
  const horizontalGestureTriggeredRef = useRef(false)
  const lastHorizontalGestureEventAtRef = useRef(0)
  const lastGestureWasBackRef = useRef<boolean | null>(null)
  const latestContentWheelHandlerRef = useRef<(event: WheelEvent) => void>(
    () => undefined
  )
  const currentLinks = useMemo(
    () => getLinksAtFolderPath(rootLinks, folderPath),
    [folderPath, rootLinks]
  )
  const currentFolderKey = folderPath.at(-1)?.id ?? item.url

  useEffect(() => {
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

  const resetHorizontalGesture = () => {
    horizontalGestureDistanceRef.current = 0
    horizontalGestureTriggeredRef.current = false
    lastHorizontalGestureEventAtRef.current = 0
    lastGestureWasBackRef.current = null
  }

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
    const nextFolderPath = forwardFolderPaths[0]
    if (!nextFolderPath) {
      return
    }
    rememberScrollPosition()
    setForwardFolderPaths((currentForwardFolderPaths) =>
      currentForwardFolderPaths.slice(1)
    )
    setFolderPath(nextFolderPath)
  }

  const handleContentWheel = (event: WheelEvent) => {
    const currentTimeMs = Date.now()
    if (
      currentTimeMs - lastHorizontalGestureEventAtRef.current >
      FINDER_NAVIGATION_GESTURE_RESET_DELAY_MS
    ) {
      resetHorizontalGesture()
    }

    const isHorizontalGesture = Math.abs(event.deltaX) > Math.abs(event.deltaY)
    if (!isHorizontalGesture || event.deltaX === 0) {
      resetHorizontalGesture()
      return
    }

    const isBackGesture = event.deltaX < 0
    if (
      lastGestureWasBackRef.current !== null &&
      lastGestureWasBackRef.current !== isBackGesture
    ) {
      resetHorizontalGesture()
    }
    lastGestureWasBackRef.current = isBackGesture
    lastHorizontalGestureEventAtRef.current = currentTimeMs

    if (!isBackGesture && forwardFolderPaths.length === 0) {
      resetHorizontalGesture()
      return
    }

    event.preventDefault()
    if (horizontalGestureTriggeredRef.current) {
      return
    }

    horizontalGestureDistanceRef.current += Math.abs(event.deltaX)
    if (
      horizontalGestureDistanceRef.current <
      FINDER_NAVIGATION_GESTURE_TRIGGER_DISTANCE_PX
    ) {
      return
    }

    horizontalGestureTriggeredRef.current = true
    horizontalGestureDistanceRef.current = 0
    if (isBackGesture) {
      navigateToParentFolder()
    } else {
      navigateToNextFolder()
    }
  }

  useEffect(() => {
    latestContentWheelHandlerRef.current = handleContentWheel
  }, [handleContentWheel])

  useEffect(() => {
    const contentElement = contentRef.current
    if (!contentElement) {
      return
    }
    const handleNativeWheel = (event: WheelEvent) => {
      latestContentWheelHandlerRef.current(event)
    }
    contentElement.addEventListener("wheel", handleNativeWheel, {
      passive: false,
    })
    return () => contentElement.removeEventListener("wheel", handleNativeWheel)
  }, [rootLinks.length === 0])

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

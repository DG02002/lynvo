import { useEffect, useMemo, useRef, useState } from "react"
import { toLinkViewModel } from "~/features/links/link-view-models"
import type { ExtractedLink, LinkViewItem } from "~/features/links/types"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import {
  getLinkKey,
  getLinksAtFolderPath,
  type FolderLevel,
} from "./save-list-browser-model"

interface UseFinderBrowserStateOptions {
  item: LinkViewItem
  actions: LinkItemActions
}

export const useFinderBrowserState = ({
  item,
  actions,
}: UseFinderBrowserStateOptions) => {
  const itemRootLinks = useMemo(
    () => toLinkViewModel(item).extractedLinks,
    [item]
  )
  const [rootLinks, setRootLinks] = useState(() => itemRootLinks)
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
    actions.markOpened(item.url, link.url)
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

    actions.markOpened(item.url, link.url)
    actions.play(link)
  }

  return {
    rootLinks,
    folderPath,
    currentLinks,
    contentRef,
    openFolder,
    openLink,
    selectRoot: () => {
      rememberScrollPosition()
      setFolderPath([])
    },
  }
}

import { useState } from "react"
import type { LinkCardActions } from "~/features/links/link-card-actions"
import { getRecentLinkViewItemMetadata } from "~/features/links/link-metadata-accessors"
import type { ExtractedLink, RecentLinkViewItem } from "~/features/links/types"

interface UseResolvableContainerStateOptions {
  item: RecentLinkViewItem
  link: ExtractedLink
  actions: LinkCardActions
}

export const useResolvableContainerState = ({
  item,
  link,
  actions,
}: UseResolvableContainerStateOptions) => {
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

  const refreshLink = () => {
    setMirrors([])
    void resolveLink(true)
  }

  return {
    mirrors,
    isExpanded,
    didResolutionFail,
    displaySize,
    resolutionState: didResolutionFail
      ? "failed"
      : mirrors.length > 0
        ? isExpanded
          ? "expanded"
          : "collapsed"
        : "unresolved",
    openLink,
    refreshLink,
  }
}

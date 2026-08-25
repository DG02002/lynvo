import { useState } from "react"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { getLinkViewItemMetadata } from "~/features/links/link-metadata-accessors"
import type { ExtractedLink, LinkViewItem } from "~/features/links/types"
import { getMediaNodeTarget } from "~/features/links/media-node-interaction"

interface UseResolvableContainerStateOptions {
  item: LinkViewItem
  link: ExtractedLink
  actions: LinkItemActions
}

export const useResolvableContainerState = ({
  item,
  link,
  actions,
}: UseResolvableContainerStateOptions) => {
  const linkTarget = getMediaNodeTarget(link)
  const savedMirrors =
    getLinkViewItemMetadata(item).playback.resolvedMirrors?.[linkTarget] ?? []
  const [mirrors, setMirrors] = useState(() =>
    savedMirrors.filter((mirror) => mirror.status !== "down")
  )
  const [isExpanded, setIsExpanded] = useState(false)
  const [didResolutionFail, setDidResolutionFail] = useState(false)
  const displaySize = link.size

  const resolveLink = async (bypassCache = false) => {
    setDidResolutionFail(false)
    setIsExpanded(true)
    const resolvedLinks = await actions.expandMirror(
      item.url,
      linkTarget,
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

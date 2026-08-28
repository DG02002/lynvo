import { useState } from "react"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { getLinkViewItemMetadata } from "~/features/links/link-metadata-accessors"
import type { ExtractedLink, LinkViewItem } from "~/features/links/types"
import { getMediaNodeTarget } from "~/features/links/media-node-interaction"
import { isPlayableLinkFresh } from "~/features/links/link-playback-metadata"

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
  const isMirrorAvailable = (mirror: ExtractedLink): boolean =>
    mirror.status !== "down" && isPlayableLinkFresh(mirror)
  const [mirrors, setMirrors] = useState(() =>
    savedMirrors.filter(isMirrorAvailable)
  )
  const [isExpanded, setIsExpanded] = useState(false)
  const [didResolutionFail, setDidResolutionFail] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const displaySize = link.size

  const resolveLink = async (bypassCache = false) => {
    setDidResolutionFail(false)
    setIsExpanded(true)
    setIsResolving(true)
    try {
      const resolvedLinks = await actions.expandMirror(
        item.url,
        linkTarget,
        bypassCache
      )
      const availableMirrors = resolvedLinks?.filter(isMirrorAvailable) ?? []
      setMirrors(availableMirrors)
      if (!availableMirrors.length) {
        setIsExpanded(false)
        setDidResolutionFail(true)
      }
    } finally {
      setIsResolving(false)
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
    isResolving,
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

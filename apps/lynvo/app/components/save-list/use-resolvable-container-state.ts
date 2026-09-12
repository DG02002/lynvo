import { useRef, useState } from "react"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { getLinkViewItemMetadata } from "~/features/links/link-metadata-accessors"
import type { ExtractedLink, LinkViewItem } from "~/features/links/types"
import { getMediaNodeTarget } from "~/features/links/media-node-interaction"
import { isPlayableLinkFresh } from "~/features/links/link-playback-metadata"

interface UseResolvableContainerStateOptions {
  item: LinkViewItem
  link: ExtractedLink
  actions: LinkItemActions
  isResolving: boolean
}

const getResolvableContainerState = (
  didResolutionFail: boolean,
  hasMirrors: boolean,
  isExpanded: boolean
) => {
  if (didResolutionFail) {
    return "failed"
  }

  if (hasMirrors) {
    if (isExpanded) {
      return "expanded"
    }

    return "collapsed"
  }

  return "unresolved"
}

const isMirrorAvailable = (mirror: ExtractedLink): boolean =>
  mirror.status !== "down" && isPlayableLinkFresh(mirror)

export const useResolvableContainerState = ({
  item,
  link,
  actions,
  isResolving: isExternallyResolving,
}: UseResolvableContainerStateOptions) => {
  const linkTarget = getMediaNodeTarget(link)
  const savedMirrors =
    getLinkViewItemMetadata(item).playback.resolvedMirrors?.[linkTarget] ?? []
  const [mirrors, setMirrors] = useState(() =>
    savedMirrors.filter(isMirrorAvailable)
  )
  const [isExpanded, setIsExpanded] = useState(false)
  const [didResolutionFail, setDidResolutionFail] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const isResolutionInFlight = useRef(false)
  const displaySize = link.size

  const resolveLink = async (bypassCache = false) => {
    if (isExternallyResolving || isResolutionInFlight.current) {
      return
    }

    isResolutionInFlight.current = true
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
      if (availableMirrors.length) {
        setIsExpanded(true)
        setDidResolutionFail(false)
      } else {
        setIsExpanded(false)
        setDidResolutionFail(true)
      }
    } finally {
      isResolutionInFlight.current = false
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
    resolutionState: getResolvableContainerState(
      didResolutionFail,
      mirrors.length > 0,
      isExpanded
    ),
    openLink,
    refreshLink,
  }
}

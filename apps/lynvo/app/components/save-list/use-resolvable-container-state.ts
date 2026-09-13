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

const EMPTY_MIRRORS: ExtractedLink[] = []

export const useResolvableContainerState = ({
  item,
  link,
  actions,
  isResolving: isExternallyResolving,
}: UseResolvableContainerStateOptions) => {
  const linkTarget = getMediaNodeTarget(link)
  const savedMirrors =
    getLinkViewItemMetadata(item).playback.resolvedMirrors?.[linkTarget] ??
    EMPTY_MIRRORS
  const [mirrorOverride, setMirrorOverride] = useState<{
    source: ExtractedLink[]
    mirrors: ExtractedLink[]
  } | null>(null)
  const mirrors =
    mirrorOverride?.source === savedMirrors
      ? mirrorOverride.mirrors
      : savedMirrors.filter(isMirrorAvailable)
  const [isExpanded, setIsExpanded] = useState(false)
  const [didResolutionFail, setDidResolutionFail] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const localResolveInFlight = useRef(false)
  const displaySize = link.size
  const isResolveInFlight = () =>
    isExternallyResolving || localResolveInFlight.current

  const resolveLink = async (bypassCache = false) => {
    if (isResolveInFlight()) {
      return
    }

    localResolveInFlight.current = true
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
      setMirrorOverride({ source: savedMirrors, mirrors: availableMirrors })
      if (!availableMirrors.length) {
        setIsExpanded(false)
        setDidResolutionFail(true)
      }
    } catch {
      setIsExpanded(false)
      setDidResolutionFail(true)
    } finally {
      localResolveInFlight.current = false
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
    if (isResolveInFlight()) {
      return
    }

    setMirrorOverride({ source: savedMirrors, mirrors: [] })
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

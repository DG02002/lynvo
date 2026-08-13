import type { ExtractedLink } from "./types"
import {
  getMediaNodeKey,
  getMediaNodeTargetOrUndefined,
} from "./media-node-interaction"

export const stripOpenedFlags = (
  links: ExtractedLink[] = []
): ExtractedLink[] =>
  links.map(({ opened: _opened, children, ...link }) => {
    if (!children) {
      return link
    }
    return { ...link, children: stripOpenedFlags(children) }
  })

export const removeLinkFromTree = (
  links: ExtractedLink[],
  linkKey: string
): ExtractedLink[] =>
  links.reduce<ExtractedLink[]>((remainingLinks, link) => {
    if (getMediaNodeKey(link) === linkKey) {
      return remainingLinks
    }

    remainingLinks.push(
      link.children
        ? { ...link, children: removeLinkFromTree(link.children, linkKey) }
        : link
    )
    return remainingLinks
  }, [])

export const attachResolvedChildren = ({
  links,
  linkId,
  linkUrl,
  resolvedChildren,
}: {
  links: ExtractedLink[]
  linkId: string
  linkUrl: string
  resolvedChildren: ExtractedLink[]
}): ExtractedLink[] =>
  links.map((link) => {
    if (
      getMediaNodeKey(link) === linkId ||
      getMediaNodeTargetOrUndefined(link) === linkUrl
    ) {
      return { ...link, children: resolvedChildren, childrenResolved: true }
    }
    return link.children
      ? {
          ...link,
          children: attachResolvedChildren({
            links: link.children,
            linkId,
            linkUrl,
            resolvedChildren,
          }),
        }
      : link
  })

export const mergeUnique = (
  ...lists: Array<Array<string | undefined> | undefined>
) => {
  const values = new Set<string>()
  for (const list of lists) {
    for (const value of list ?? []) {
      if (value) {
        values.add(value)
      }
    }
  }
  return [...values]
}

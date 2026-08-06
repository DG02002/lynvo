import type { ExtractedLink } from "./types"

export const collectOpened = (links: ExtractedLink[] = []) => {
  const openedUrls = new Set<string>()
  const openedIds = new Set<string>()

  const visit = (items: ExtractedLink[]) => {
    for (const link of items) {
      if (link.opened) {
        if (link.url) {
          openedUrls.add(link.url)
        }
        if (link.id) {
          openedIds.add(link.id)
        }
      }
      if (link.children?.length) {
        visit(link.children)
      }
    }
  }

  visit(links)
  return { openedUrls: [...openedUrls], openedIds: [...openedIds] }
}

export const stripOpenedFlags = (
  links: ExtractedLink[] = []
): ExtractedLink[] =>
  links.map(({ opened: _opened, children, ...link }) => ({
    ...link,
    ...(children ? { children: stripOpenedFlags(children) } : {}),
  }))

export const removeLinkFromTree = (
  links: ExtractedLink[],
  linkKey: string
): ExtractedLink[] =>
  links.reduce<ExtractedLink[]>((remainingLinks, link) => {
    if ((link.id ?? link.url) === linkKey) {
      return remainingLinks
    }

    remainingLinks.push({
      ...link,
      ...(link.children
        ? { children: removeLinkFromTree(link.children, linkKey) }
        : {}),
    })
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
    if (link.id === linkId || link.url === linkUrl) {
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

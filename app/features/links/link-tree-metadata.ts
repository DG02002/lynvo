import type { ExtractedLink } from "./types"

export const collectWatched = (links: ExtractedLink[] = []) => {
  const watchedUrls = new Set<string>()
  const watchedIds = new Set<string>()

  const visit = (items: ExtractedLink[]) => {
    for (const link of items) {
      if (link.watched) {
        if (link.url) {
          watchedUrls.add(link.url)
        }
        if (link.id) {
          watchedIds.add(link.id)
        }
      }
      if (link.children?.length) {
        visit(link.children)
      }
    }
  }

  visit(links)
  return { watchedUrls: [...watchedUrls], watchedIds: [...watchedIds] }
}

export const stripWatchedFlags = (
  links: ExtractedLink[] = []
): ExtractedLink[] =>
  links.map(({ watched: _watched, children, ...link }) => ({
    ...link,
    ...(children ? { children: stripWatchedFlags(children) } : {}),
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

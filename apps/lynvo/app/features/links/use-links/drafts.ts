import { useCallback, useEffect, useMemo, useState } from "react"
import { getExpiringDrafts } from "~/components/links/DraftManager"
import type { LinkViewItem } from "~/features/links/types"

const draftToLinkViewItem = (
  draft: ReturnType<typeof getExpiringDrafts>[number]
): LinkViewItem => ({
  url: draft.originalUrl,
  timestamp: draft.expiresAt - 24 * 60 * 60 * 1000,
  title: draft.meta.pageTitle || draft.meta.title || draft.originalUrl,
  extractedLinks: draft.links,
  meta: draft.meta,
  pluginName: draft.meta.pluginName,
  pluginIcon: draft.meta.pluginIcon,
  isDraft: true,
  draftExpiresAt: draft.expiresAt,
})

export function useDraftLinks(links: LinkViewItem[]) {
  const [drafts, setDrafts] = useState<LinkViewItem[]>([])

  const refreshDrafts = useCallback(() => {
    setDrafts(getExpiringDrafts().map(draftToLinkViewItem))
  }, [])

  useEffect(() => {
    refreshDrafts()
    window.addEventListener("storage", refreshDrafts)
    window.addEventListener("lynvo:drafts:change", refreshDrafts)
    return () => {
      window.removeEventListener("storage", refreshDrafts)
      window.removeEventListener("lynvo:drafts:change", refreshDrafts)
    }
  }, [refreshDrafts])

  return useMemo(() => {
    const draftUrls = new Set(drafts.map((draft) => draft.url))
    const filteredLinks = links.filter((link) => !draftUrls.has(link.url))
    return [...drafts, ...filteredLinks]
  }, [drafts, links])
}

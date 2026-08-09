import { useMemo, useSyncExternalStore } from "react"
import { DRAFT_TTL_MS } from "~/features/links/constants"
import {
  getDraftsSnapshot,
  getServerDraftsSnapshot,
  subscribeToDrafts,
  type Draft,
} from "~/features/links/drafts"
import type {
  DraftListItem,
  LinkListItem,
  LinkViewItem,
} from "~/features/links/types"

const draftToLinkViewItem = (draft: Draft): DraftListItem => ({
  kind: "draft",
  url: draft.originalUrl,
  timestamp: draft.expiresAt - DRAFT_TTL_MS,
  title: draft.meta.pageTitle || draft.meta.title || draft.originalUrl,
  extractedLinks: draft.links,
  meta: draft.meta,
  pluginName: draft.meta.pluginName,
  pluginIcon: draft.meta.pluginIcon,
  expiresAt: draft.expiresAt,
})

export const useDraftLinks = (links: LinkViewItem[]): LinkListItem[] => {
  const drafts = useSyncExternalStore(
    subscribeToDrafts,
    getDraftsSnapshot,
    getServerDraftsSnapshot
  )

  return useMemo(() => {
    const draftUrls = new Set(drafts.map((draft) => draft.originalUrl))
    const filteredLinks = links.filter((link) => !draftUrls.has(link.url))
    return [
      ...drafts.map(draftToLinkViewItem),
      ...filteredLinks.map((link) => ({ ...link, kind: "saved" as const })),
    ]
  }, [drafts, links])
}

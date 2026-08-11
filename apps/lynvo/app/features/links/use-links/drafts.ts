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

const draftToLinkViewItem = (userId: string, draft: Draft): DraftListItem => ({
  kind: "draft",
  url: draft.originalUrl,
  timestamp: draft.expiresAt - DRAFT_TTL_MS,
  title: draft.meta.pageTitle || draft.meta.title || draft.originalUrl,
  extractedLinks: draft.links,
  meta: draft.meta,
  pluginName: draft.meta.pluginName,
  pluginIcon: draft.meta.pluginIcon,
  expiresAt: draft.expiresAt,
  userId,
})

export const useDraftLinks = (
  userId: string | undefined,
  links: LinkViewItem[]
): LinkListItem[] => {
  const drafts = useSyncExternalStore(
    (subscriber) =>
      userId ? subscribeToDrafts(userId, subscriber) : () => undefined,
    () => (userId ? getDraftsSnapshot(userId) : []),
    getServerDraftsSnapshot
  )

  return useMemo(() => {
    const draftUrls = new Set(drafts.map((draft) => draft.originalUrl))
    const filteredLinks = links.filter((link) => !draftUrls.has(link.url))
    return [
      ...drafts.map((draft) => draftToLinkViewItem(userId!, draft)),
      ...filteredLinks.map((link) => ({ ...link, kind: "saved" as const })),
    ]
  }, [drafts, links])
}

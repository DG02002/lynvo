import { savedLinkApiRecordToViewItem } from "~/features/links/use-links/api"
import type { Route } from "./+types/_site.save"

export const saveRouteMeta = (_: Route.MetaArgs) => [{ title: "Save | Lynvo" }]

export const toInitialSaveItems = (savedLinks: readonly SavedLinkApiRecord[]) =>
  savedLinks.flatMap((record) => {
    const item = savedLinkApiRecordToViewItem(record)
    return item ? [item] : []
  })

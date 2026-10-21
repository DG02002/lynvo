import type { ShouldRevalidateFunction } from "react-router"
import type { SavedLinkApiRecord } from "~shared/api-contracts"

import { savedLinkApiRecordToViewItem } from "~/features/links/use-links"
import { SAVE_FOLDER_PATH_SEARCH_PARAM } from "~/lib/paths"

import type { Route } from "./+types/_site.save"

export const saveRouteMeta = (_: Route.MetaArgs) => [
  { title: "Save | Lynvo" },
  {
    name: "description",
    content: "Save links to open them in your preferred Android player.",
  },
]

export const toInitialSaveItems = (savedLinks: readonly SavedLinkApiRecord[]) =>
  savedLinks.flatMap((record) => {
    const item = savedLinkApiRecordToViewItem(record)
    return item ? [item] : []
  })

// The group and folder-path params only change which part of the snapshot is
// on screen, so they must not re-run the loader. Realtime version comparison
// keeps the reused snapshot fresh.
const searchWithout = (url: URL, ...keys: string[]): string => {
  const searchParams = new URLSearchParams(url.search)
  for (const key of keys) {
    searchParams.delete(key)
  }
  return searchParams.toString()
}

const hasSameSnapshotSearch = (currentUrl: URL, nextUrl: URL): boolean =>
  searchWithout(currentUrl, "group", SAVE_FOLDER_PATH_SEARCH_PARAM) ===
  searchWithout(nextUrl, "group", SAVE_FOLDER_PATH_SEARCH_PARAM)

type SaveRouteRevalidationArgs = Parameters<ShouldRevalidateFunction>[0]

export const shouldRevalidateSaveRoute: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
  formMethod,
}: SaveRouteRevalidationArgs) => {
  if (formMethod && formMethod.toUpperCase() !== "GET") {
    return defaultShouldRevalidate
  }

  // An identical URL means an explicit revalidate() call: honor it.
  const isSameLocation =
    currentUrl.pathname === nextUrl.pathname &&
    currentUrl.search === nextUrl.search
  return !isSameLocation && hasSameSnapshotSearch(currentUrl, nextUrl)
    ? false
    : defaultShouldRevalidate
}

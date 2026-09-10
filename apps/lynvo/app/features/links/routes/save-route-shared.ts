import { savedLinkApiRecordToViewItem } from "~/features/links/use-links/api"
import { savePaths } from "~/lib/paths"
import type { ShouldRevalidateFunction } from "react-router"
import type { Route } from "./+types/_site.save"

export const saveRouteMeta = (_: Route.MetaArgs) => [{ title: "Save | Lynvo" }]

export const toInitialSaveItems = (savedLinks: readonly SavedLinkApiRecord[]) =>
  savedLinks.flatMap((record) => {
    const item = savedLinkApiRecordToViewItem(record)
    return item ? [item] : []
  })

const searchWithoutGroup = (url: URL): string => {
  const searchParams = new URLSearchParams(url.search)
  searchParams.delete("group")
  return searchParams.toString()
}

const searchWithoutGroupAndFolderPath = (url: URL): string => {
  const searchParams = new URLSearchParams(url.search)
  searchParams.delete("group")
  searchParams.delete("path")
  return searchParams.toString()
}

const isSaveFolderPath = (pathname: string): boolean =>
  pathname.startsWith(savePaths.folderPrefix)

const hasSameNonGroupSearch = (currentUrl: URL, nextUrl: URL): boolean =>
  searchWithoutGroup(currentUrl) === searchWithoutGroup(nextUrl)

type SaveRouteRevalidationArgs = Parameters<ShouldRevalidateFunction>[0]

const shouldRevalidateSavedLinksRoute = (
  args: SaveRouteRevalidationArgs,
  canReuseSnapshot: (args: SaveRouteRevalidationArgs) => boolean
): boolean => {
  const { defaultShouldRevalidate, formMethod } = args
  if (formMethod && formMethod.toUpperCase() !== "GET") {
    return defaultShouldRevalidate
  }

  return canReuseSnapshot(args) ? false : defaultShouldRevalidate
}

export const shouldRevalidateSaveRoute: ShouldRevalidateFunction = (args) =>
  shouldRevalidateSavedLinksRoute(
    args,
    ({ currentUrl, nextUrl }) =>
      currentUrl.pathname === nextUrl.pathname &&
      currentUrl.search !== nextUrl.search &&
      hasSameNonGroupSearch(currentUrl, nextUrl)
  )

export const shouldRevalidateSaveFolderRoute: ShouldRevalidateFunction = (
  args
) =>
  shouldRevalidateSavedLinksRoute(
    args,
    ({ currentUrl, nextUrl }) =>
      isSaveFolderPath(currentUrl.pathname) &&
      isSaveFolderPath(nextUrl.pathname) &&
      searchWithoutGroupAndFolderPath(currentUrl) ===
        searchWithoutGroupAndFolderPath(nextUrl) &&
      (currentUrl.pathname !== nextUrl.pathname ||
        currentUrl.search !== nextUrl.search)
  )

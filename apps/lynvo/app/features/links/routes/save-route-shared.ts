import { savedLinkApiRecordToViewItem } from "~/features/links/use-links/api"
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

const isSaveFolderPath = (pathname: string): boolean =>
  pathname.startsWith("/save/folder/")

export const shouldRevalidateSaveRoute: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
  formMethod,
}) => {
  if (formMethod && formMethod.toUpperCase() !== "GET") {
    return defaultShouldRevalidate
  }

  if (
    currentUrl.pathname === nextUrl.pathname &&
    currentUrl.search !== nextUrl.search &&
    searchWithoutGroup(currentUrl) === searchWithoutGroup(nextUrl)
  ) {
    return false
  }

  return defaultShouldRevalidate
}

export const shouldRevalidateSaveFolderRoute: ShouldRevalidateFunction = (
  args
) => {
  const { currentUrl, nextUrl, defaultShouldRevalidate, formMethod } = args
  if (formMethod && formMethod.toUpperCase() !== "GET") {
    return defaultShouldRevalidate
  }

  if (
    isSaveFolderPath(currentUrl.pathname) &&
    isSaveFolderPath(nextUrl.pathname) &&
    searchWithoutGroup(currentUrl) === searchWithoutGroup(nextUrl)
  ) {
    return false
  }

  return shouldRevalidateSaveRoute(args)
}

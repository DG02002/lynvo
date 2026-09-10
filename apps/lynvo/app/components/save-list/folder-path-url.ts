import { SAVE_FOLDER_PATH_SEARCH_PARAM } from "~/lib/paths"
import { type FolderLevel } from "./save-list-browser-model"

export { SAVE_FOLDER_PATH_SEARCH_PARAM } from "~/lib/paths"

export interface ParsedFolderPath {
  hasSearchParam: boolean
  ids: string[]
}

const decodeSearchComponent = (value: string): string | undefined => {
  try {
    return decodeURIComponent(value.replaceAll("+", " "))
  } catch {
    return undefined
  }
}

const getRawSearchParam = (
  search: string,
  parameterName: string
): string | null => {
  const query = search.startsWith("?") ? search.slice(1) : search
  for (const entry of query.split("&")) {
    if (!entry) {
      continue
    }
    const separatorIndex = entry.indexOf("=")
    const rawName =
      separatorIndex === -1 ? entry : entry.slice(0, separatorIndex)
    if (decodeSearchComponent(rawName) !== parameterName) {
      continue
    }
    return separatorIndex === -1 ? "" : entry.slice(separatorIndex + 1)
  }
  return null
}

export const parseFolderPath = (search: string): ParsedFolderPath => {
  const rawPath = getRawSearchParam(search, SAVE_FOLDER_PATH_SEARCH_PARAM)
  if (rawPath === null) {
    return { hasSearchParam: false, ids: [] }
  }
  if (rawPath === "") {
    return { hasSearchParam: true, ids: [] }
  }

  // Keep slash separators readable in the URL and decode each segment
  // independently so an opaque identifier may contain an encoded slash.
  const rawSegments = rawPath.split("/")
  if (rawSegments.some((segment) => segment === "")) {
    return { hasSearchParam: true, ids: [] }
  }

  const ids: string[] = []
  for (const rawSegment of rawSegments) {
    const id = decodeSearchComponent(rawSegment)
    if (!id) {
      return { hasSearchParam: true, ids: [] }
    }
    ids.push(id)
  }
  return { hasSearchParam: true, ids }
}

export const encodeFolderPath = (folderPath: FolderLevel[]): string =>
  folderPath.map((folder) => encodeURIComponent(folder.id)).join("/")

export const createFolderPathSearch = (
  currentSearch: string,
  folderPath: FolderLevel[]
): string => {
  const searchParams = new URLSearchParams(currentSearch)
  searchParams.delete(SAVE_FOLDER_PATH_SEARCH_PARAM)
  const otherSearch = searchParams.toString()
  if (folderPath.length === 0) {
    return otherSearch ? `?${otherSearch}` : ""
  }

  const encodedPath = encodeFolderPath(folderPath)
  const prefix = otherSearch ? `${otherSearch}&` : ""
  return `?${prefix}${SAVE_FOLDER_PATH_SEARCH_PARAM}=${encodedPath}`
}

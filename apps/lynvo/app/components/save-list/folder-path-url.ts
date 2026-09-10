import { getMediaNodeInteractionState } from "~/features/links/media-node-interaction"
import type { ExtractedLink } from "~/features/links/types"
import { getLinkKey, type FolderLevel } from "./save-list-browser-model"

export const SAVE_FOLDER_PATH_SEARCH_PARAM = "path"

export interface ParsedFolderPath {
  hasSearchParam: boolean
  ids: string[]
  isMalformed: boolean
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
    return { hasSearchParam: false, ids: [], isMalformed: false }
  }
  if (rawPath === "") {
    return { hasSearchParam: true, ids: [], isMalformed: false }
  }

  // Keep slash separators readable in the URL and decode each segment
  // independently so an opaque identifier may contain an encoded slash.
  const rawSegments = rawPath.split("/")
  if (rawSegments.some((segment) => segment === "")) {
    return { hasSearchParam: true, ids: [], isMalformed: true }
  }

  const ids: string[] = []
  for (const rawSegment of rawSegments) {
    const id = decodeSearchComponent(rawSegment)
    if (!id) {
      return { hasSearchParam: true, ids: [], isMalformed: true }
    }
    ids.push(id)
  }
  return { hasSearchParam: true, ids, isMalformed: false }
}

export const encodeFolderPath = (folderPath: FolderLevel[]): string =>
  folderPath.map((folder) => encodeURIComponent(folder.id)).join("/")

export const resolveFolderPath = (
  rootLinks: ExtractedLink[],
  folderIds: string[]
): FolderLevel[] => {
  const resolvedPath: FolderLevel[] = []
  let links = rootLinks
  for (const folderId of folderIds) {
    const folder = links.find((link) => getLinkKey(link) === folderId)
    if (!folder || !getMediaNodeInteractionState(folder).isFolder) {
      break
    }
    resolvedPath.push({ id: folderId, label: folder.label })
    links = folder.children ?? []
  }
  return resolvedPath
}

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

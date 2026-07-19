import type { ExtractedLink } from "~/features/links/types"
import { createBhadooAuthenticatedRequest } from "./bhadoo-basic-auth"
import {
  BYTES_PER_KIBIBYTE,
  FILE_SIZE_DECIMAL_PLACES,
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  LEGACY_RESPONSE_PREFIX_LENGTH,
  LEGACY_RESPONSE_SUFFIX_LENGTH,
} from "./bhadoo-google-drive-index-constants"
import { isVideoFile } from "./video-file"

export interface BhadooGoogleDriveItem {
  id: string
  name: string
  mimeType: string
  link?: string | null
  size?: string
}

export interface BhadooGoogleDriveListResponse {
  nextPageToken: string | null
  curPageIndex: number
  data?: {
    files?: BhadooGoogleDriveItem[]
  }
  error?: {
    code?: number
    message?: string
  }
}

const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"]

export const getBhadooPathFilename = (url: string | URL) => {
  const parsedUrl = typeof url === "string" ? new URL(url) : url
  const finalSegment = parsedUrl.pathname.split("/").filter(Boolean).at(-1)
  return finalSegment ? decodeURIComponent(finalSegment) : "Google Drive Index"
}

const createBhadooDirectMediaLink = (url: URL): ExtractedLink | null => {
  const filename = getBhadooPathFilename(url)
  const playableUrl = new URL(url)
  const actionValues = playableUrl.searchParams.getAll("a")
  if (actionValues.includes("view")) {
    playableUrl.searchParams.delete("a")
    for (const actionValue of actionValues) {
      if (actionValue !== "view") {
        playableUrl.searchParams.append("a", actionValue)
      }
    }
  }
  return isVideoFile(filename)
    ? { type: "file", label: filename, url: playableUrl.toString() }
    : null
}

export const formatBhadooFileSize = (size?: string): string | undefined => {
  if (!size) {
    return undefined
  }

  let value = Number(size)
  if (!Number.isFinite(value) || value < 0) {
    return undefined
  }

  let unitIndex = 0
  while (
    value >= BYTES_PER_KIBIBYTE &&
    unitIndex < FILE_SIZE_UNITS.length - 1
  ) {
    value /= BYTES_PER_KIBIBYTE
    unitIndex += 1
  }

  const formattedValue =
    unitIndex === 0
      ? String(value)
      : value
          .toFixed(FILE_SIZE_DECIMAL_PLACES)
          .replace(/\.0+$|(?<=\.[0-9])0+$/, "")
  return `${formattedValue} ${FILE_SIZE_UNITS[unitIndex]}`
}

export const createBhadooFolderLink = (
  item: BhadooGoogleDriveItem,
  folderUrl: URL
): ExtractedLink => {
  const pathname = folderUrl.pathname.endsWith("/")
    ? folderUrl.pathname
    : `${folderUrl.pathname}/`
  const targetUrl = new URL(folderUrl.origin)
  targetUrl.username = folderUrl.username
  targetUrl.password = folderUrl.password
  targetUrl.pathname = `${pathname}${item.name}/`

  return {
    id: item.id,
    type: "folder",
    label: item.name,
    url: targetUrl.toString(),
    selectable: true,
    children: [],
    childrenResolved: false,
  }
}

export const createBhadooFileLink = (
  item: BhadooGoogleDriveItem,
  baseUrl: string | URL
): ExtractedLink | null => {
  if (!isVideoFile(item.name)) {
    return null
  }

  const folderUrl = new URL(baseUrl)
  const directUrl = new URL(folderUrl)
  if (item.link) {
    directUrl.href = new URL(item.link, folderUrl).href
  } else {
    const pathname = folderUrl.pathname.endsWith("/")
      ? folderUrl.pathname
      : `${folderUrl.pathname}/`
    directUrl.pathname = `${pathname}${item.name}`
  }

  return {
    id: item.id,
    type: "file",
    label: item.name,
    url: directUrl.toString(),
    size: formatBhadooFileSize(item.size),
  }
}

export const processBhadooItems = (
  items: ReadonlyArray<BhadooGoogleDriveItem>,
  folderUrl: URL
): ExtractedLink[] =>
  items.flatMap((item) => {
    if (item.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE) {
      return [createBhadooFolderLink(item, folderUrl)]
    }

    const fileLink = createBhadooFileLink(item, folderUrl)
    return fileLink ? [fileLink] : []
  })

export const decodeLegacyBhadooResponse = (
  encodedResponse: string
): BhadooGoogleDriveListResponse => {
  const reversedResponse = encodedResponse.split("").reverse().join("")
  const base64Response = reversedResponse
    .slice(LEGACY_RESPONSE_PREFIX_LENGTH)
    .slice(0, -LEGACY_RESPONSE_SUFFIX_LENGTH)
  const responseBytes = Uint8Array.from(atob(base64Response), (character) =>
    character.charCodeAt(0)
  )
  return JSON.parse(new TextDecoder().decode(responseBytes))
}

const requestModernBhadooPage = async (
  requestUrl: URL,
  authorization: string | undefined,
  pageToken: string,
  pageIndex: number
) => {
  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify({
      password: "",
      page_token: pageToken,
      page_index: pageIndex,
    }),
  })

  if (!response.ok) {
    return undefined
  }

  return (await response.json().catch(() => undefined)) as
    | BhadooGoogleDriveListResponse
    | undefined
}

const requestLegacyBhadooPage = async (
  requestUrl: URL,
  authorization: string | undefined,
  pageToken: string,
  pageIndex: number
) => {
  const body = new URLSearchParams({
    password: "",
    page_token: pageToken,
    page_index: String(pageIndex),
  })
  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: body.toString(),
  })

  if (!response.ok) {
    throw new Error(
      `Bhadoo Google Drive Index request failed (Status ${response.status})`
    )
  }

  return decodeLegacyBhadooResponse(await response.text())
}

export const extractBhadooGoogleDriveIndex = async (
  url: string
): Promise<ExtractedLink[]> => {
  const folderUrl = new URL(url)
  const directMediaLink = createBhadooDirectMediaLink(folderUrl)
  if (directMediaLink) {
    return [directMediaLink]
  }
  const authenticatedRequest = createBhadooAuthenticatedRequest(folderUrl)
  const links: ExtractedLink[] = []
  let pageToken = ""
  let pageIndex = 0

  do {
    const modernResult = await requestModernBhadooPage(
      authenticatedRequest.url,
      authenticatedRequest.authorization,
      pageToken,
      pageIndex
    )
    const result =
      modernResult ??
      (await requestLegacyBhadooPage(
        authenticatedRequest.url,
        authenticatedRequest.authorization,
        pageToken,
        pageIndex
      ))
    if (result.error) {
      throw new Error(
        result.error.message || "Bhadoo Google Drive Index rejected the request"
      )
    }

    links.push(...processBhadooItems(result.data?.files ?? [], folderUrl))
    pageToken = result.nextPageToken ?? ""
    pageIndex = result.curPageIndex + 1
  } while (pageToken)

  return links
}

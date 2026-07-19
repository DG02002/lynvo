import type { ExtractedLink } from "~/features/links/types"
import { fetchWithRetry, sha256 } from "./onedrive-index-fetch"
import { extractOneDriveNextData } from "./onedrive-next-data"
import { isVideoFile } from "./video-file"

const PASSWORD_CONFIGURATION_REQUIRED_MESSAGE =
  "Configure this OneDrive Index password in Settings, then try again."

export interface OneDriveItem {
  name: string
  id: string
  folder?: unknown
  file?: unknown
}

export interface OneDriveApiResponse {
  folder?: {
    value: OneDriveItem[]
  }
  file?: OneDriveItem
  next?: string
  error?: string
}

export { isVideoFile }

export const encodeOneDrivePath = (path: string): string => {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

export const createOneDriveFileLink = (
  item: OneDriveItem,
  parentPath: string,
  origin: string,
  hashedPassword: string
): ExtractedLink => {
  let fullPath = parentPath
  if (!fullPath.endsWith("/")) {
    fullPath += "/"
  }
  fullPath += item.name

  let linkUrl = `${origin}/api/raw/?path=${encodeURIComponent(fullPath)}`
  if (hashedPassword) {
    linkUrl += `&odpt=${hashedPassword}`
  }

  return {
    url: linkUrl,
    label: item.name,
    id: item.id,
    type: "file",
  }
}

export const createOneDriveFolderLink = (
  item: OneDriveItem,
  currentPath: string,
  origin: string
): ExtractedLink => {
  const nextPath = currentPath.endsWith("/")
    ? currentPath + item.name
    : `${currentPath}/${item.name}`

  return {
    type: "folder",
    label: item.name,
    url: `${origin}${encodeOneDrivePath(nextPath)}`,
    id: item.id,
    selectable: true,
    children: [],
  }
}

export const processOneDriveItems = async (
  items: ReadonlyArray<OneDriveItem>,
  currentPath: string,
  origin: string,
  hashedPassword: string
): Promise<ExtractedLink[]> => {
  const results = items.map((item) => {
    if (item.folder) {
      return {
        ...createOneDriveFolderLink(item, currentPath, origin),
        childrenResolved: false,
      }
    }

    if (item.file && isVideoFile(item.name)) {
      return createOneDriveFileLink(item, currentPath, origin, hashedPassword)
    }

    return null
  })

  return results.filter((result): result is ExtractedLink => result !== null)
}

export const extractOneDriveIndex = async (url: string, password?: string) => {
  const parsedUrl = new URL(url)
  const origin = parsedUrl.origin
  const path = decodeURIComponent(parsedUrl.pathname)
  const headers: Record<string, string> = {}
  const hashedPassword = password ? await sha256(password) : ""

  if (hashedPassword) {
    headers["od-protected-token"] = hashedPassword
  }

  const fetchPage = async (
    currentPath: string,
    nextToken = "",
    items: ExtractedLink[] = []
  ): Promise<ExtractedLink[]> => {
    let apiUrl = `${origin}/api?path=${encodeURIComponent(currentPath)}`
    if (nextToken) {
      apiUrl += `&next=${encodeURIComponent(nextToken)}`
    }

    try {
      const response = await fetchWithRetry(apiUrl, { headers })

      if (response.status === 401) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string
        }
        if (data.error === "Password required.") {
          throw new Error(PASSWORD_CONFIGURATION_REQUIRED_MESSAGE)
        }
      }

      if (!response.ok) {
        return items
      }

      const data = (await response.json()) as OneDriveApiResponse

      if (data.folder) {
        items.push(
          ...(await processOneDriveItems(
            data.folder.value,
            currentPath,
            origin,
            hashedPassword
          ))
        )
        return data.next ? fetchPage(currentPath, data.next, items) : items
      }

      if (data.file) {
        const lastSlashIndex = currentPath.lastIndexOf("/")
        const parentPath =
          lastSlashIndex >= 0 ? currentPath.substring(0, lastSlashIndex) : ""

        if (isVideoFile(data.file.name)) {
          items.push(
            createOneDriveFileLink(
              data.file,
              parentPath,
              origin,
              hashedPassword
            )
          )
        }
      }

      return items
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === PASSWORD_CONFIGURATION_REQUIRED_MESSAGE
      ) {
        throw error
      }
      console.error("Error fetching OneDrive Index API:", error)
      return items
    }
  }

  const fetchPath = async (
    targetPath: string,
    isInitial = false
  ): Promise<ExtractedLink[]> => {
    if (isInitial) {
      try {
        const response = await fetchWithRetry(url, { headers })
        if (response.ok) {
          const html = await response.text()
          const data = extractOneDriveNextData(html)

          if (data) {
            if (data.folder) {
              return processOneDriveItems(
                data.folder.value,
                path,
                origin,
                hashedPassword
              )
            }

            if (data.file) {
              const lastSlashIndex = path.lastIndexOf("/")
              const parentPath =
                lastSlashIndex >= 0 ? path.substring(0, lastSlashIndex) : ""
              if (isVideoFile(data.file.name)) {
                return [
                  createOneDriveFileLink(
                    data.file,
                    parentPath,
                    origin,
                    hashedPassword
                  ),
                ]
              }
              return []
            }
          }
        }
      } catch (error) {
        console.error("Initial extraction failed, falling back to API", error)
      }
    }

    return fetchPage(targetPath)
  }

  return await fetchPath(path, true)
}

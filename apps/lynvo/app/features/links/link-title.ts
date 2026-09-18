import type { MetaData } from "~/features/links/types"

export const getFilenameFromUrl = (url: string): string => {
  try {
    const parsedUrl = new URL(url)
    const disposition =
      parsedUrl.searchParams.get("response-content-disposition") ??
      parsedUrl.searchParams.get("content-disposition")
    if (disposition) {
      const match = disposition.match(
        /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i
      )
      if (match?.[1]) {
        return decodeURIComponent(match[1].trim())
      }
    }
    const queryFilename =
      parsedUrl.searchParams.get("filename") ??
      parsedUrl.searchParams.get("file")
    if (queryFilename) {
      return decodeURIComponent(queryFilename.trim())
    }
    const lastPathPart = parsedUrl.pathname
      .split("/")
      .findLast((pathPart) => pathPart.length > 0)
    return lastPathPart && lastPathPart.length > 1
      ? decodeURIComponent(lastPathPart)
      : parsedUrl.hostname
  } catch {
    return url
  }
}

export const getLinkTitle = (targetUrl: string, meta: MetaData) =>
  meta.title || meta.pageTitle || meta.filename || getFilenameFromUrl(targetUrl)

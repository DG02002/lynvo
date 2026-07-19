import { ALLOWED_MIME_TYPES, BAD_EXTENSIONS } from "./direct-media-data"
export const DIRECT_LINK_EXTRACT_TIMEOUT_MS = 8000
export const DIRECT_LINK_FETCH_TIMEOUT_MS = 10000

const REGEX_FILENAME_STAR = /filename\*=UTF-8''([^;]+)/i
const REGEX_FILENAME_QUOTED = /filename="?([^"]+)"?/i

export const DIRECT_LINK_BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; SendLinkToJustPlayer/1.0)",
  "Accept-Encoding": "identity",
}

export const findUnsupportedExtension = (filename: string) => {
  const lowerName = filename.toLowerCase()
  return BAD_EXTENSIONS.find((extension) => lowerName.endsWith(extension))
}

export const assertSupportedFilename = (filename: string) => {
  const extension = findUnsupportedExtension(filename)
  if (extension) {
    throw new Error(`This file type isn’t supported (${extension})`)
  }
}

export const getUrlFilename = (
  url: string,
  options = { requireDot: false }
) => {
  const parsedUrl = new URL(url)
  const lastPathPart = parsedUrl.pathname.split("/").at(-1)
  if (!lastPathPart) {
    return null
  }
  if (options.requireDot && !lastPathPart.includes(".")) {
    return null
  }
  return decodeURIComponent(lastPathPart)
}

export const getContentDispositionFilename = (contentDisposition: string) => {
  const filenameStarMatch = contentDisposition.match(REGEX_FILENAME_STAR)
  if (filenameStarMatch?.[1]) {
    return decodeURIComponent(filenameStarMatch[1])
  }

  const filenameMatch = contentDisposition.match(REGEX_FILENAME_QUOTED)
  if (filenameMatch?.[1]) {
    return decodeURIComponent(filenameMatch[1])
  }

  return null
}

export const getResponseFilename = (url: string, headers: Headers) => {
  const contentDisposition = headers.get("content-disposition")
  if (contentDisposition) {
    const headerFilename = getContentDispositionFilename(contentDisposition)
    if (headerFilename) {
      return headerFilename
    }
  }

  try {
    const urlFilename = getUrlFilename(url)
    if (urlFilename && (urlFilename.includes(".") || urlFilename.length > 3)) {
      return urlFilename
    }
  } catch {}

  return "Unknown File"
}

export const isAllowedDirectContentType = (contentType: string) =>
  ALLOWED_MIME_TYPES.some((type) => contentType.includes(type))

export const createRangeHeaders = () => ({
  ...DIRECT_LINK_BASE_HEADERS,
  Range: "bytes=0-1",
})

export const isSuccessfulDirectStatus = (status: number) =>
  status === 206 || status === 200

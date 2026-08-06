import { ALLOWED_MIME_TYPES, BAD_EXTENSIONS } from "./direct-media-data"
import type {
  ExpirySource,
  RangeRequestCapability,
} from "@dg02002/lynvo-plugin-server-protocol"
import { MILLISECONDS_PER_SECOND } from "~/lib/constants"

export const DIRECT_LINK_EXTRACT_TIMEOUT_MS = 8000
export const DIRECT_LINK_FETCH_TIMEOUT_MS = 10000

const REGEX_FILENAME_STAR = /filename\*=UTF-8''([^;]+)/i
const REGEX_FILENAME_QUOTED = /filename="?([^"]+)"?/i
const REGEX_AMZ_DATE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/
const REGEX_MAX_AGE = /(?:^|,)\s*max-age\s*=\s*"?(\d+)/i
const MILLISECONDS_EPOCH_THRESHOLD = 1_000_000_000_000

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
  Range: "bytes=0-0",
})

export const isSuccessfulDirectStatus = (status: number) =>
  status === 206 || status === 200

export const getRangeRequestCapability = (
  status: number,
  headers: Headers
): RangeRequestCapability => {
  if (status === 206 && headers.has("content-range")) {
    return "supported"
  }
  if (status === 200) {
    return "unsupported"
  }
  return "unknown"
}

const parseAmazonDate = (value: string): number | undefined => {
  const match = REGEX_AMZ_DATE.exec(value)
  if (!match) {
    return undefined
  }

  const [, year, month, day, hour, minute, second] = match
  const yearNumber = Number(year)
  const monthNumber = Number(month)
  const dayNumber = Number(day)
  const hourNumber = Number(hour)
  const minuteNumber = Number(minute)
  const secondNumber = Number(second)
  const timestamp = Date.UTC(
    yearNumber,
    monthNumber - 1,
    dayNumber,
    hourNumber,
    minuteNumber,
    secondNumber
  )
  const date = new Date(timestamp)
  return Number.isNaN(timestamp) ||
    date.getUTCFullYear() !== yearNumber ||
    date.getUTCMonth() !== monthNumber - 1 ||
    date.getUTCDate() !== dayNumber ||
    date.getUTCHours() !== hourNumber ||
    date.getUTCMinutes() !== minuteNumber ||
    date.getUTCSeconds() !== secondNumber
    ? undefined
    : timestamp
}

const parseNumericExpiry = (value: string | null): number | undefined => {
  if (!value) {
    return undefined
  }

  const timestamp = Number(value)
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return undefined
  }

  return timestamp < MILLISECONDS_EPOCH_THRESHOLD
    ? timestamp * MILLISECONDS_PER_SECOND
    : timestamp
}

const getSignedUrlExpiry = (url: string): number | undefined => {
  const parsedUrl = new URL(url)
  const amzDate = parsedUrl.searchParams.get("X-Amz-Date")
  const amzExpires = Number(parsedUrl.searchParams.get("X-Amz-Expires"))
  const signedAt = amzDate ? parseAmazonDate(amzDate) : undefined
  if (
    signedAt !== undefined &&
    Number.isInteger(amzExpires) &&
    amzExpires >= 0
  ) {
    return signedAt + amzExpires * MILLISECONDS_PER_SECOND
  }

  return parseNumericExpiry(parsedUrl.searchParams.get("Expires"))
}

export interface ResponseExpiry {
  expiry?: number
  expirySource?: ExpirySource
}

export const getResponseExpiry = (
  url: string,
  headers: Headers
): ResponseExpiry => {
  try {
    const signedUrlExpiry = getSignedUrlExpiry(url)
    if (signedUrlExpiry !== undefined) {
      return { expiry: signedUrlExpiry, expirySource: "signed-url" }
    }
  } catch {}

  const cacheControl = headers.get("cache-control")
  const maxAgeMatch = cacheControl?.match(REGEX_MAX_AGE)
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : undefined
  if (maxAgeSeconds !== undefined) {
    if (!Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0) {
      return {}
    }
    const responseDate = headers.get("date")
    const parsedResponseDate = responseDate ? Date.parse(responseDate) : NaN
    const baseTime = Number.isFinite(parsedResponseDate)
      ? parsedResponseDate
      : Date.now()
    return {
      expiry: baseTime + maxAgeSeconds * MILLISECONDS_PER_SECOND,
      expirySource: "cache-control",
    }
  }

  const expiresHeader = headers.get("expires")
  if (expiresHeader) {
    const expiry = Date.parse(expiresHeader)
    const responseDate = headers.get("date")
    const responseDateTimestamp = responseDate ? Date.parse(responseDate) : NaN
    const comparisonTimestamp = Number.isFinite(responseDateTimestamp)
      ? responseDateTimestamp
      : Date.now()
    if (Number.isFinite(expiry) && expiry > comparisonTimestamp) {
      return { expiry, expirySource: "expires-header" }
    }
  }

  return {}
}

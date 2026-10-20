import { decodeUrlComponent } from "../url-policy"
import { formatFileSize } from "./file-size"

const CONTENT_RANGE_TOTAL = /\/(\d+)$/

const getContentDispositionParameter = (
  contentDisposition: string,
  parameterName: "filename" | "filename*"
): string | undefined => {
  const escapedParameterName = parameterName.replaceAll("*", "\\*")
  const pattern = new RegExp(
    `(?:^|;)\\s*${escapedParameterName}\\s*=\\s*(?:"((?:\\\\.|[^"\\\\])*)"|([^;]*))`,
    "i"
  )
  const match = pattern.exec(contentDisposition)
  const quotedValue = match?.[1]
  if (quotedValue !== undefined) {
    return quotedValue.replaceAll(/\\(["\\])/g, "$1")
  }
  return match?.[2]?.trim()
}

export const parseContentDispositionFilename = (
  contentDisposition: string | null
): string | undefined => {
  if (!contentDisposition) {
    return undefined
  }

  const extendedFilename = getContentDispositionParameter(
    contentDisposition,
    "filename*"
  )
  if (extendedFilename !== undefined) {
    const utf8Prefix = /^UTF-8'[^']*'/i.exec(extendedFilename)?.[0]
    const encodedFilename = utf8Prefix
      ? extendedFilename.slice(utf8Prefix.length)
      : extendedFilename
    if (encodedFilename) {
      return decodeUrlComponent(encodedFilename)
    }
  }

  const filename = getContentDispositionParameter(
    contentDisposition,
    "filename"
  )
  return filename ? decodeUrlComponent(filename) : undefined
}

export const getResponseFileSize = (
  status: number,
  headers: Headers
): string | undefined => {
  const rangeSize = CONTENT_RANGE_TOTAL.exec(
    headers.get("Content-Range") ?? ""
  )?.[1]
  const responseSize =
    rangeSize ??
    (status === 200 ? (headers.get("Content-Length") ?? undefined) : undefined)
  return formatFileSize(responseSize)
}

export const getLastPathSegment = (
  pathname: string,
  fallback: string
): string => {
  const lastSegment = pathname
    .split("/")
    .findLast((pathSegment) => pathSegment.length > 0)
  return lastSegment ? decodeUrlComponent(lastSegment) : fallback
}

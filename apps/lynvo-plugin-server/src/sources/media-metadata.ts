import { decodeUrlComponent } from "../url-policy"
import { formatFileSize } from "./file-size"

const CONTENT_RANGE_TOTAL = /\/(\d+)$/
const EXTENDED_FILENAME_VALUE = /^([^']*)'[^']*'(.*)$/
const INVALID_PERCENT_ESCAPE = /%(?![\da-f]{2})/i

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

const decodeExtendedFilename = (
  extendedFilename: string
): string | undefined => {
  const match = EXTENDED_FILENAME_VALUE.exec(extendedFilename)
  const charset = match?.[1]?.toLowerCase()
  const encodedFilename = match?.[2]
  if (
    !charset ||
    !encodedFilename ||
    INVALID_PERCENT_ESCAPE.test(encodedFilename)
  ) {
    return undefined
  }
  if (charset === "utf-8") {
    return decodeUrlComponent(encodedFilename)
  }
  if (charset === "iso-8859-1") {
    return encodedFilename.replaceAll(
      /%([\da-f]{2})/gi,
      (_match, hexadecimalByte: string) =>
        String.fromCharCode(Number.parseInt(hexadecimalByte, 16))
    )
  }
  return undefined
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
    const decodedExtendedFilename = decodeExtendedFilename(extendedFilename)
    if (decodedExtendedFilename) {
      return decodedExtendedFilename
    }
  }

  const filename = getContentDispositionParameter(
    contentDisposition,
    "filename"
  )
  return filename || undefined
}

export const getResponseFileSize = (
  response: Pick<Response, "status" | "headers">
): string | undefined => {
  const rangeSize = CONTENT_RANGE_TOTAL.exec(
    response.headers.get("Content-Range") ?? ""
  )?.[1]
  const responseSize =
    rangeSize ??
    (response.status === 200
      ? (response.headers.get("Content-Length") ?? undefined)
      : undefined)
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

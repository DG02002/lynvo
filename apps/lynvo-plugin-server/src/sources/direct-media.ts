import { ProtocolError } from "@dg02002/lynvo-plugin-server-protocol"

import {
  DIRECT_MEDIA_BLOCKED_EXTENSIONS,
  DIRECT_MEDIA_CONTENT_TYPES,
  DIRECT_MEDIA_RANGE_HEADER,
  MILLISECONDS_EPOCH_THRESHOLD,
  MILLISECONDS_PER_SECOND,
} from "../constants"
import {
  createPluginResponseMetadata,
  type PluginAdapterOptions,
} from "../plugin-adapter"
import { fetchValidatedUpstream } from "../upstream-response"
import { decodeUrlComponent } from "../url-policy"
import { formatFileSize } from "./file-size"
import { readRangeRequestCapability } from "./media-node"

const CONTENT_DISPOSITION_FILENAME =
  /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i
const CONTENT_RANGE_TOTAL = /\/(\d+)$/
const MAX_SIGNED_URL_DURATION_SECONDS = 31_536_000

const getFilename = (targetUrl: string, headers: Headers): string => {
  const headerFilename = CONTENT_DISPOSITION_FILENAME.exec(
    headers.get("Content-Disposition") ?? ""
  )?.[1]
  if (headerFilename) {
    return decodeUrlComponent(headerFilename)
  }
  const parsedUrl = new URL(targetUrl)
  const queryDisposition =
    parsedUrl.searchParams.get("response-content-disposition") ??
    parsedUrl.searchParams.get("content-disposition")
  if (queryDisposition) {
    const match = CONTENT_DISPOSITION_FILENAME.exec(queryDisposition)?.[1]
    if (match) {
      return decodeUrlComponent(match)
    }
  }
  const queryFilename =
    parsedUrl.searchParams.get("filename") ?? parsedUrl.searchParams.get("file")
  if (queryFilename) {
    return decodeUrlComponent(queryFilename)
  }
  const pathFilename = parsedUrl.pathname.split("/").at(-1)
  return pathFilename ? decodeUrlComponent(pathFilename) : "Unknown File"
}

const getFileSize = (status: number, headers: Headers): string | undefined => {
  const rangeSize = CONTENT_RANGE_TOTAL.exec(
    headers.get("Content-Range") ?? ""
  )?.[1]
  return formatFileSize(
    rangeSize ??
      (status === 200
        ? (headers.get("Content-Length") ?? undefined)
        : undefined)
  )
}

const getSignedUrlExpiry = (targetUrl: string, now: number) => {
  const value = new URL(targetUrl).searchParams.get("Expires")
  const timestamp = Number(value)
  if (!value || !Number.isFinite(timestamp) || timestamp <= 0) {
    return {}
  }
  const absoluteExpiry =
    timestamp < MILLISECONDS_EPOCH_THRESHOLD
      ? timestamp * MILLISECONDS_PER_SECOND
      : timestamp
  // A successful probe proves the URL works now. Some hosts put a short
  // relative duration in Expires; preserve it as an estimate instead of
  // interpreting it as a 1970 timestamp. Older values stay unknown because
  // they could be stale absolute timestamps rather than useful durations.
  const isShortRelativeDuration =
    timestamp < MILLISECONDS_EPOCH_THRESHOLD &&
    timestamp <= MAX_SIGNED_URL_DURATION_SECONDS
  const expiry =
    absoluteExpiry <= now && isShortRelativeDuration
      ? now + timestamp * MILLISECONDS_PER_SECOND
      : absoluteExpiry
  if (expiry <= now) {
    return {}
  }
  return {
    expiry,
    expirySource: "signed-url" as const,
  }
}

export const extractDirectMedia = async (options: PluginAdapterOptions) => {
  const response = await fetchValidatedUpstream(options.targetUrl, {
    headers: {
      "Accept-Encoding": "identity",
      Range: DIRECT_MEDIA_RANGE_HEADER,
    },
  })
  try {
    const contentType =
      response.headers.get("Content-Type")?.toLowerCase() ?? ""
    const filename = getFilename(options.targetUrl, response.headers)
    const isSupportedContent = DIRECT_MEDIA_CONTENT_TYPES.some((candidate) =>
      contentType.startsWith(candidate)
    )
    const isBlockedFilename = DIRECT_MEDIA_BLOCKED_EXTENSIONS.some(
      (extension) => filename.toLowerCase().endsWith(extension)
    )
    if (
      (response.status !== 200 && response.status !== 206) ||
      !isSupportedContent ||
      isBlockedFilename
    ) {
      throw new ProtocolError(
        "UNSUPPORTED_URL",
        "The URL does not point at playable media."
      )
    }

    const node = {
      kind: "playable" as const,
      label: filename,
      url: options.targetUrl,
      status: "up" as const,
      rangeRequest: readRangeRequestCapability(response),
      size: getFileSize(response.status, response.headers),
      ...getSignedUrlExpiry(options.targetUrl, Date.now()),
    }
    return {
      plugin: createPluginResponseMetadata(
        options.plugin,
        options.publicAssetOrigin
      ),
      nodes: [node],
      extensions: {},
    }
  } finally {
    await response.body?.cancel()
  }
}

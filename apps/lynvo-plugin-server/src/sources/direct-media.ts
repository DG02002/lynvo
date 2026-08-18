import {
  DIRECT_MEDIA_CONTENT_TYPES,
  DIRECT_MEDIA_RANGE_HEADER,
  MILLISECONDS_EPOCH_THRESHOLD,
  MILLISECONDS_PER_SECOND,
} from "../constants"
import {
  createPluginResponseMetadata,
  type PluginAdapterOptions,
} from "../plugin-catalog"
import { fetchValidatedUpstream } from "../upstream-response"
import { formatFileSize } from "./file-size"

const CONTENT_DISPOSITION_FILENAME =
  /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i
const CONTENT_RANGE_TOTAL = /\/(\d+)$/

const getFilename = (targetUrl: string, headers: Headers): string => {
  const headerFilename = CONTENT_DISPOSITION_FILENAME.exec(
    headers.get("Content-Disposition") ?? ""
  )?.[1]
  if (headerFilename) {
    return decodeURIComponent(headerFilename)
  }
  const pathname = new URL(targetUrl).pathname
  const pathFilename = pathname.split("/").at(-1)
  return pathFilename ? decodeURIComponent(pathFilename) : "Unknown File"
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

const getSignedUrlExpiry = (targetUrl: string) => {
  const value = new URL(targetUrl).searchParams.get("Expires")
  const timestamp = Number(value)
  if (!value || !Number.isFinite(timestamp) || timestamp <= 0) {
    return {}
  }
  return {
    expiry:
      timestamp < MILLISECONDS_EPOCH_THRESHOLD
        ? timestamp * MILLISECONDS_PER_SECOND
        : timestamp,
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
    const isSupportedContent = DIRECT_MEDIA_CONTENT_TYPES.some((candidate) =>
      contentType.startsWith(candidate)
    )
    if (
      (response.status !== 200 && response.status !== 206) ||
      !isSupportedContent
    ) {
      throw new Error("UNSUPPORTED_URL")
    }

    const node = {
      kind: "playable" as const,
      label: getFilename(options.targetUrl, response.headers),
      url: options.targetUrl,
      status: "up" as const,
      rangeRequest:
        response.status === 206 && response.headers.has("Content-Range")
          ? ("supported" as const)
          : ("unsupported" as const),
      size: getFileSize(response.status, response.headers),
      ...getSignedUrlExpiry(options.targetUrl),
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

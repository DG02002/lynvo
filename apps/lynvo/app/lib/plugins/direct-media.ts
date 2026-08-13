import type { ExtractedLink } from "~/features/links/types"
import type { MetadataResult } from "~/lib/effect/services/extraction-types"
import { DIRECT_MEDIA_ICON } from "~/lib/plugin-icons"
import {
  DIRECT_LINK_EXTRACT_TIMEOUT_MS,
  DIRECT_LINK_FETCH_TIMEOUT_MS,
  assertSupportedFilename,
  createRangeHeaders,
  getContentDispositionFilename,
  getRangeRequestCapability,
  getResponseFileSize,
  getResponseExpiry,
  getResponseFilename,
  getUrlFilename,
  isAllowedDirectContentType,
  isSuccessfulDirectStatus,
} from "./direct-media-policy"

export interface DirectMediaModule {
  readonly extract: (url: string) => Promise<ExtractedLink[]>
  readonly getMetadata: (url: string) => Promise<MetadataResult>
}

const getDirectFilename = (url: string, headers: Headers): string => {
  const contentDisposition = headers.get("content-disposition")
  if (contentDisposition) {
    const headerFilename = getContentDispositionFilename(contentDisposition)
    if (headerFilename) {
      return headerFilename
    }
  }
  try {
    return getUrlFilename(url, { requireDot: true }) ?? ""
  } catch {
    return ""
  }
}

const fetchRange = (
  transport: OutboundHttpTransport,
  url: string,
  timeoutMs: number
) =>
  transport.fetch(url, {
    method: "GET",
    headers: createRangeHeaders(),
    responseBodyMode: "discard",
    timeoutMs,
  })

const validateDirectMediaResponse = (response: Response) => {
  if (!isSuccessfulDirectStatus(response.status)) {
    throw new Error(`The connection failed (Status ${response.status})`)
  }
  const contentType = response.headers.get("content-type") || ""
  if (!isAllowedDirectContentType(contentType)) {
    throw new Error(
      `This content isn’t a supported video format (${contentType})`
    )
  }
}

export const createDirectMediaModule = (
  transport: OutboundHttpTransport
): DirectMediaModule => ({
  extract: async (url) => {
    try {
      try {
        const urlFilename = getUrlFilename(url)
        if (urlFilename) {
          assertSupportedFilename(urlFilename)
        }
      } catch (error) {
        if (!(error instanceof TypeError)) {
          throw error
        }
      }

      const response = await fetchRange(
        transport,
        url,
        DIRECT_LINK_EXTRACT_TIMEOUT_MS
      )
      validateDirectMediaResponse(response)
      const filename = getResponseFilename(url, response.headers)
      if (filename !== "Unknown File") {
        assertSupportedFilename(filename)
      }
      const size = getResponseFileSize(response.status, response.headers)
      const link: ExtractedLink = {
        nodeKey: `direct:${url}`,
        url,
        label: filename,
        id: "direct",
        type: "file",
        mediaNodeKind: "playable",
        status: "up",
        rangeRequest: getRangeRequestCapability(
          response.status,
          response.headers
        ),
        ...getResponseExpiry(url, response.headers),
      }
      if (size) {
        link.size = size
      }
      return [link]
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("The connection timed out")
        }
        throw error
      }
      throw new Error(
        String(error) ||
          "The link couldn’t be validated. Check it and try again."
      )
    }
  },
  getMetadata: async (url) => {
    const response = await fetchRange(
      transport,
      url,
      DIRECT_LINK_FETCH_TIMEOUT_MS
    )
    validateDirectMediaResponse(response)
    const metadata: MetadataResult = {
      filename: getDirectFilename(url, response.headers),
      pluginId: "direct-link",
      pluginName: "Direct Media",
    }
    return DIRECT_MEDIA_ICON.url
      ? { ...metadata, pluginIcon: DIRECT_MEDIA_ICON.url }
      : metadata
  },
})

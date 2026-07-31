import type { CheerioAPI } from "cheerio"
import type { ExtractedLink } from "~/features/links/types"
import type { PluginIconSource } from "~/lib/plugin-icons"
import {
  DIRECT_LINK_EXTRACT_TIMEOUT_MS,
  DIRECT_LINK_FETCH_TIMEOUT_MS,
  assertSupportedFilename,
  createRangeHeaders,
  getContentDispositionFilename,
  getResponseFilename,
  getUrlFilename,
  isAllowedDirectContentType,
  isSuccessfulDirectStatus,
} from "./direct-media-policy"

const getDirectFilename = (
  url: string,
  $: CheerioAPI | null,
  headers?: Headers
) => {
  const contentDisposition = headers?.get("content-disposition")
  if (contentDisposition) {
    const headerFilename = getContentDispositionFilename(contentDisposition)
    if (headerFilename) {
      return headerFilename
    }
  }

  try {
    const urlFilename = getUrlFilename(url, { requireDot: true })
    if (urlFilename) {
      return urlFilename
    }
  } catch {}

  const title = $?.("title").text()
  return title ? title.trim() : null
}

const fetchDirectRange = async (url: string, timeoutMs: number) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: createRangeHeaders(),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

export interface DirectMediaAdapter {
  id: string
  name: string
  icon: PluginIconSource
  canHandle: (url: string) => boolean | Promise<boolean>
  getFilename: (
    url: string,
    document: CheerioAPI | null,
    headers?: Headers
  ) => string | null
  extract: (url: string) => Promise<ExtractedLink[]>
  fetch: (
    url: string,
    env?: Env
  ) => Promise<{ status: number; headers: Headers; $: CheerioAPI | null }>
}

export const directMediaAdapter: DirectMediaAdapter = {
  id: "direct-link",
  name: "Direct Link",
  icon: {},
  canHandle: (_url: string) => {
    return true
  },

  getFilename: getDirectFilename,

  extract: async (url: string): Promise<ExtractedLink[]> => {
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

    try {
      const response = await fetchDirectRange(
        url,
        DIRECT_LINK_EXTRACT_TIMEOUT_MS
      )
      if (!isSuccessfulDirectStatus(response.status)) {
        throw new Error(`The connection failed (Status ${response.status})`)
      }

      const contentType = response.headers.get("content-type") || ""
      if (!isAllowedDirectContentType(contentType)) {
        throw new Error(
          `This content isn’t a supported video format (${contentType})`
        )
      }

      const filename = getResponseFilename(url, response.headers)
      if (filename !== "Unknown File") {
        assertSupportedFilename(filename)
      }

      return [
        {
          url,
          label: filename,
          id: "direct",
          rangeRequest: response.status === 206 ? "supported" : "unsupported",
        },
      ]
    } catch (error: unknown) {
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

  fetch: async (url: string) => {
    const response = await fetchDirectRange(url, DIRECT_LINK_FETCH_TIMEOUT_MS)

    if (!isSuccessfulDirectStatus(response.status)) {
      throw new Error(`Connection failed (Status ${response.status})`)
    }

    return {
      status: response.status,
      headers: response.headers,
      $: null,
    }
  },
}

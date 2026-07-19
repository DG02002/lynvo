import type { CheerioAPI } from "cheerio"
import type { Plugin } from "./types"
import { ONEDRIVE_DETECTION_TIMEOUT_MS } from "./onedrive-index-fetch"
import {
  extractOneDriveIndex,
  isVideoFile,
  encodeOneDrivePath,
  createOneDriveFileLink,
  createOneDriveFolderLink,
  processOneDriveItems,
  type OneDriveItem,
  type OneDriveApiResponse,
} from "./onedrive-index-extractor"

export {
  createOneDriveFileLink,
  createOneDriveFolderLink,
  encodeOneDrivePath,
  isVideoFile,
  processOneDriveItems,
}

export type { OneDriveApiResponse, OneDriveItem }

const isLikelyDirectFilePath = (url: string) => {
  try {
    const parsedUrl = new URL(url)
    return Boolean(
      parsedUrl.pathname
        .toLowerCase()
        .match(
          /\.(mp4|mkv|avi|mov|flv|wmv|webm|m4v|mp3|wav|flac|aac|zip|rar|7z|iso|exe|apk|pdf)$/
        )
    )
  } catch {
    return false
  }
}

const hasOneDriveIndexFingerprint = async (url: string) => {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => controller.abort(),
      ONEDRIVE_DETECTION_TIMEOUT_MS
    )

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SendLinkToJustPlayer/1.0)",
        Range: "bytes=0-4096",
      },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (response.status === 206 || response.ok) {
      const text = await response.text()
      const normalizedText = text.toLowerCase()
      return (
        normalizedText.includes("onedrive-vercel-index") ||
        normalizedText.includes("onedrive vercel index")
      )
    }
  } catch {
    return false
  }

  return false
}

const getOneDriveFilename = (_url: string, $: CheerioAPI | null) => {
  if (!$) {
    return null
  }

  const breadcrumb = $("ol.flex-row-reverse li").first().text().trim()
  if (breadcrumb) {
    return breadcrumb
  }

  return $("title").text().trim()
}

export const onedriveIndexPlugin: Plugin = {
  id: "onedrive-index",
  name: "Spencerwooo's Onedrive Vercel Index",
  icon: { url: "/icons/plugins/onedrive-index.webp" },
  status: "operational",
  descriptionUrl: "https://github.com/spencerwooo/onedrive-vercel-index",
  requiresAuth: true,
  credential: {
    pluginId: "onedrive-index",
    kind: "domain-password",
  },

  canHandle: async (url: string) => {
    if (url.includes("onedrive-vercel-index")) {
      return true
    }

    if (isLikelyDirectFilePath(url)) {
      return false
    }

    return await hasOneDriveIndexFingerprint(url)
  },

  getFilename: getOneDriveFilename,

  extract: async (url: string, password?: string) => {
    return await extractOneDriveIndex(url, password)
  },
}

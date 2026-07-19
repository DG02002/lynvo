import { load, type CheerioAPI } from "cheerio"
import type { Plugin } from "./types"
import { BUILT_IN_PLUGIN_ICONS } from "~/lib/plugin-icons"
import { createBhadooAuthenticatedRequest } from "./bhadoo-basic-auth"
import {
  BHADOO_DETECTION_TIMEOUT_MS,
  BHADOO_SCRIPT_URL_PREFIX,
  LEGACY_BHADOO_SCRIPT_URL_PREFIX,
} from "./bhadoo-google-drive-index-constants"
import {
  extractBhadooGoogleDriveIndex,
  getBhadooPathFilename,
} from "./bhadoo-google-drive-index-extractor"
import { isVideoFile } from "./video-file"

const getBhadooFilename = (url: string, _document: CheerioAPI | null) => {
  return getBhadooPathFilename(url)
}

const hasBhadooGoogleDriveIndexPage = async (url: string) => {
  const authenticatedRequest = createBhadooAuthenticatedRequest(url)
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    BHADOO_DETECTION_TIMEOUT_MS
  )

  try {
    const response = await fetch(authenticatedRequest.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Lynvo/1.0)",
        ...(authenticatedRequest.authorization
          ? { Authorization: authenticatedRequest.authorization }
          : {}),
      },
      signal: controller.signal,
    })
    if (!response.ok) {
      return false
    }

    const html = await response.text()
    return (
      html.includes(BHADOO_SCRIPT_URL_PREFIX) ||
      html.includes(LEGACY_BHADOO_SCRIPT_URL_PREFIX) ||
      /bhadoo/i.test(html)
    )
  } catch {
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}

export const bhadooGoogleDriveIndexPlugin: Plugin = {
  id: "bhadoo-google-drive-index",
  name: "Bhadoo’s Google Drive Index",
  icon: BUILT_IN_PLUGIN_ICONS["Bhadoo’s Google Drive Index"],
  status: "operational",
  descriptionUrl: "https://gitlab.com/GoogleDriveIndex/Google-Drive-Index",
  requiresAuth: false,
  credential: {
    pluginId: "bhadoo-google-drive-index",
    kind: "http-basic",
  },

  canHandle: hasBhadooGoogleDriveIndexPage,
  getFilename: getBhadooFilename,
  extract: async (url: string) => extractBhadooGoogleDriveIndex(url),
  fetch: async (url: string) => {
    const authenticatedRequest = createBhadooAuthenticatedRequest(url)
    const isDirectMedia = isVideoFile(getBhadooPathFilename(url))
    const response = await fetch(authenticatedRequest.url, {
      ...(isDirectMedia ? { method: "HEAD" } : {}),
      headers: authenticatedRequest.authorization
        ? { Authorization: authenticatedRequest.authorization }
        : {},
    })
    const html = isDirectMedia ? undefined : await response.text()

    return {
      status: response.status,
      headers: response.headers,
      $: html === undefined ? null : load(html),
    }
  },
}

import { load } from "cheerio"
import type {
  ExtractorNode,
  ExtractSuccessResponse,
} from "@lynvo/extractor-protocol"
import type { SourceAdapterOptions } from "../source-catalog"
import { createSourceResponseMetadata } from "../source-catalog"
import {
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  GOOGLE_DRIVE_PUBLIC_FOLDER_MAX_HTML_BYTES,
  GOOGLE_DRIVE_PUBLIC_FOLDER_MAX_ITEMS,
  UPSTREAM_TIMEOUT_MS,
} from "../constants"
import { formatFileSize } from "./file-size"
import { isVideoFile } from "./video-file"

const GOOGLE_DRIVE_FILE_PATH_PATTERN = /^\/file\/d\/([^/]+)(?:\/|$)/
const GOOGLE_DRIVE_FOLDER_PATH_PATTERN = /^\/drive\/folders\/([^/]+)(?:\/|$)/
const GOOGLE_DRIVE_FOLDER_PAYLOAD_PATTERN =
  /window\['_DRIVE_ivd'\]\s*=\s*'((?:\\.|[^'])*)'/

export const extractGoogleDriveFileId = (value: string | URL): string => {
  const url = typeof value === "string" ? new URL(value) : value
  if (url.protocol !== "https:" || url.hostname !== "drive.google.com") {
    throw new Error("UNSUPPORTED_URL")
  }
  const match = GOOGLE_DRIVE_FILE_PATH_PATTERN.exec(url.pathname)
  const fileId = match?.[1]
  if (!fileId) {
    throw new Error("UNSUPPORTED_URL")
  }
  return decodeURIComponent(fileId)
}

export const createGoogleDriveDownloadUrl = (fileId: string): string => {
  const downloadUrl = new URL("https://drive.usercontent.google.com/download")
  downloadUrl.searchParams.set("id", fileId)
  downloadUrl.searchParams.set("export", "download")
  downloadUrl.searchParams.set("confirm", "t")
  return downloadUrl.toString()
}

export const extractGoogleDriveFolderId = (value: string | URL): string => {
  const url = typeof value === "string" ? new URL(value) : value
  if (url.protocol !== "https:" || url.hostname !== "drive.google.com") {
    throw new Error("UNSUPPORTED_URL")
  }
  const folderId = GOOGLE_DRIVE_FOLDER_PATH_PATTERN.exec(url.pathname)?.[1]
  if (!folderId) {
    throw new Error("UNSUPPORTED_URL")
  }
  return decodeURIComponent(folderId)
}

export interface GoogleDrivePublicFileMetadata {
  filename: string
  size?: string
}

export const isHtmlResponse = (response: Response): boolean =>
  response.headers.get("content-type")?.toLowerCase().includes("text/html") ??
  false

const getContentDispositionFilename = (
  contentDisposition: string | null
): string | undefined => {
  if (!contentDisposition) {
    return undefined
  }
  const encodedFilename = /filename\*=UTF-8''([^;]+)/i.exec(
    contentDisposition
  )?.[1]
  if (encodedFilename) {
    return decodeURIComponent(encodedFilename)
  }
  return /filename="([^"]+)"/i.exec(contentDisposition)?.[1]
}

export const fetchGoogleDrivePublicFileMetadata = async (
  downloadUrl: string
): Promise<GoogleDrivePublicFileMetadata> => {
  const response = await fetch(downloadUrl, {
    headers: { Range: "bytes=0-0" },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  })
  if (isHtmlResponse(response)) {
    await response.body?.cancel()
    throw new Error("Google Drive file is rate-limited. Try again in 24 hours.")
  }
  if (!response.ok) {
    throw new Error("Google Drive file is not publicly accessible.")
  }
  const filename =
    getContentDispositionFilename(
      response.headers.get("content-disposition")
    ) ?? "Google Drive file"
  const totalBytes =
    /\/(\d+)$/.exec(response.headers.get("content-range") ?? "")?.[1] ??
    response.headers.get("content-length") ??
    undefined
  return { filename, size: formatFileSize(totalBytes) }
}

export interface GoogleDrivePublicFolderItem {
  id: string
  name: string
  mimeType: string
  size?: number
}

const decodeGoogleDriveFolderPayload = (payload: string): string =>
  payload
    .replace(/\\x([0-9a-f]{2})/gi, (_, hexadecimalByte: string) =>
      String.fromCharCode(Number.parseInt(hexadecimalByte, 16))
    )
    .replace(/\\'/g, "'")

export const parseGoogleDrivePublicFolderItems = (
  html: string
): GoogleDrivePublicFolderItem[] => {
  const encodedPayload = GOOGLE_DRIVE_FOLDER_PAYLOAD_PATTERN.exec(html)?.[1]
  if (!encodedPayload) {
    throw new Error("Google Drive folder is not publicly accessible.")
  }
  const parsedPayload: unknown = JSON.parse(
    decodeGoogleDriveFolderPayload(encodedPayload)
  )
  if (!Array.isArray(parsedPayload) || !Array.isArray(parsedPayload[0])) {
    throw new Error("Google Drive returned a malformed public folder.")
  }
  if (parsedPayload[0].length > GOOGLE_DRIVE_PUBLIC_FOLDER_MAX_ITEMS) {
    throw new Error("Google Drive public folder contains too many items.")
  }
  return parsedPayload[0].flatMap<GoogleDrivePublicFolderItem>((item) => {
    if (
      !Array.isArray(item) ||
      typeof item[0] !== "string" ||
      typeof item[2] !== "string" ||
      typeof item[3] !== "string"
    ) {
      return []
    }
    return [
      {
        id: item[0],
        name: item[2],
        mimeType: item[3],
        ...(typeof item[13] === "number" ? { size: item[13] } : {}),
      },
    ]
  })
}

export const createGoogleDrivePublicFolderNodes = (
  items: readonly GoogleDrivePublicFolderItem[]
): ExtractorNode[] =>
  items.flatMap<ExtractorNode>((item) => {
    if (item.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE) {
      return [
        {
          kind: "resolvable",
          id: item.id,
          label: item.name,
          nodeUrl: `https://drive.google.com/drive/folders/${item.id}`,
          resolutionKind: "folder",
        },
      ]
    }
    if (!isVideoFile(item.name)) {
      return []
    }
    return [
      {
        kind: "playable",
        id: item.id,
        label: item.name,
        url: createGoogleDriveDownloadUrl(item.id),
        ...(formatFileSize(item.size)
          ? { size: formatFileSize(item.size) }
          : {}),
        status: "unknown",
      },
    ]
  })

export const extractGoogleDrivePublicFolder = async ({
  targetUrl,
  source,
  publicAssetOrigin,
}: SourceAdapterOptions): Promise<ExtractSuccessResponse> => {
  extractGoogleDriveFolderId(targetUrl)
  const response = await fetch(targetUrl, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error("Google Drive folder is not publicly accessible.")
  }
  const declaredSize = Number(response.headers.get("content-length"))
  if (
    Number.isFinite(declaredSize) &&
    declaredSize > GOOGLE_DRIVE_PUBLIC_FOLDER_MAX_HTML_BYTES
  ) {
    await response.body?.cancel()
    throw new Error("Google Drive public folder response is too large.")
  }
  const html = await response.text()
  if (
    new TextEncoder().encode(html).byteLength >
    GOOGLE_DRIVE_PUBLIC_FOLDER_MAX_HTML_BYTES
  ) {
    throw new Error("Google Drive public folder response is too large.")
  }
  const title =
    load(html)("title")
      .first()
      .text()
      .replace(/\s+[–-]\s+Google Drive$/, "") || "Google Drive folder"
  return {
    source: createSourceResponseMetadata(source, publicAssetOrigin, title),
    nodes: createGoogleDrivePublicFolderNodes(
      parseGoogleDrivePublicFolderItems(html)
    ),
    extensions: {},
  }
}

export const extractGoogleDrivePublicFile = async ({
  targetUrl,
  source,
  publicAssetOrigin,
}: SourceAdapterOptions): Promise<ExtractSuccessResponse> => {
  const fileId = extractGoogleDriveFileId(targetUrl)
  const downloadUrl = createGoogleDriveDownloadUrl(fileId)
  const metadata = await fetchGoogleDrivePublicFileMetadata(downloadUrl)
  return {
    source: createSourceResponseMetadata(
      source,
      publicAssetOrigin,
      metadata.filename
    ),
    nodes: [
      {
        kind: "playable",
        id: fileId,
        label: metadata.filename,
        url: downloadUrl,
        ...(metadata.size ? { size: metadata.size } : {}),
        status: "unknown",
      },
    ],
    extensions: {},
  }
}

export const extractGoogleDrivePublicLink = (
  options: SourceAdapterOptions
): Promise<ExtractSuccessResponse> =>
  GOOGLE_DRIVE_FOLDER_PATH_PATTERN.test(new URL(options.targetUrl).pathname)
    ? extractGoogleDrivePublicFolder(options)
    : extractGoogleDrivePublicFile(options)

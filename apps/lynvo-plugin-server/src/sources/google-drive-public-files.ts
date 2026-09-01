import { load } from "cheerio"
import {
  ProtocolError,
  type MediaNode,
  type ExtractSuccessResponse,
} from "@dg02002/lynvo-plugin-server-protocol"
import {
  createPluginResponseMetadata,
  type PluginAdapterOptions,
} from "../plugin-catalog"
import {
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  GOOGLE_DRIVE_PUBLIC_FOLDER_MAX_HTML_BYTES,
  GOOGLE_DRIVE_PUBLIC_FOLDER_MAX_ITEMS,
} from "../constants"
import {
  fetchValidatedUpstream,
  readBoundedUpstreamText,
} from "../upstream-response"
import { formatFileSize } from "./file-size"
import { isVideoFile } from "./video-file"
import { Result, Schema } from "effect"

const GOOGLE_DRIVE_FILE_PATH_PATTERN = /^\/file\/d\/([^/]+)(?:\/|$)/
const GOOGLE_DRIVE_FOLDER_PATH_PATTERN = /^\/drive\/folders\/([^/]+)(?:\/|$)/
const GOOGLE_DRIVE_FOLDER_PAYLOAD_PATTERN =
  /window\['_DRIVE_ivd'\]\s*=\s*'((?:\\.|[^'\\])*)'/

const googleDrivePublicFolderItemSchema = Schema.TupleWithRest(
  Schema.Tuple([Schema.String, Schema.Unknown, Schema.String, Schema.String]),
  [Schema.Unknown]
)
const googleDrivePublicFolderPayloadSchema = Schema.TupleWithRest(
  Schema.Tuple([Schema.Array(googleDrivePublicFolderItemSchema)]),
  [Schema.Unknown]
)

export const extractGoogleDriveFileId = (value: string | URL): string => {
  const url = value instanceof URL ? value : new URL(value)
  if (url.protocol !== "https:" || url.hostname !== "drive.google.com") {
    throw new ProtocolError(
      "UNSUPPORTED_URL",
      "Only drive.google.com file URLs are supported."
    )
  }
  const match = GOOGLE_DRIVE_FILE_PATH_PATTERN.exec(url.pathname)
  const fileId = match?.[1]
  if (!fileId) {
    throw new ProtocolError(
      "UNSUPPORTED_URL",
      "The Google Drive URL does not contain a file id."
    )
  }
  return decodeURIComponent(fileId)
}

export const createGoogleDriveDownloadUrl = (
  fileId: string,
  resourceKey?: string
): string => {
  const downloadUrl = new URL("https://drive.usercontent.google.com/download")
  downloadUrl.searchParams.set("id", fileId)
  downloadUrl.searchParams.set("export", "download")
  downloadUrl.searchParams.set("confirm", "t")
  if (resourceKey) {
    downloadUrl.searchParams.set("resourcekey", resourceKey)
  }
  return downloadUrl.toString()
}

export const extractGoogleDriveFolderId = (value: string | URL): string => {
  const url = value instanceof URL ? value : new URL(value)
  if (url.protocol !== "https:" || url.hostname !== "drive.google.com") {
    throw new ProtocolError(
      "UNSUPPORTED_URL",
      "Only drive.google.com folder URLs are supported."
    )
  }
  const folderId = GOOGLE_DRIVE_FOLDER_PATH_PATTERN.exec(url.pathname)?.[1]
  if (!folderId) {
    throw new ProtocolError(
      "UNSUPPORTED_URL",
      "The Google Drive URL does not contain a folder id."
    )
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
  const response = await fetchValidatedUpstream(downloadUrl, {
    headers: { Range: "bytes=0-0" },
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
    (response.status === 200
      ? response.headers.get("content-length")
      : undefined) ??
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
  const parsedPayload = Schema.decodeUnknownResult(
    googleDrivePublicFolderPayloadSchema
  )(JSON.parse(decodeGoogleDriveFolderPayload(encodedPayload)))
  if (Result.isFailure(parsedPayload)) {
    throw new Error("Google Drive returned a malformed public folder.")
  }
  if (parsedPayload.success[0].length > GOOGLE_DRIVE_PUBLIC_FOLDER_MAX_ITEMS) {
    throw new Error("Google Drive public folder contains too many items.")
  }
  return parsedPayload.success[0].map<GoogleDrivePublicFolderItem>((item) => {
    const result: GoogleDrivePublicFolderItem = {
      id: item[0],
      name: item[2],
      mimeType: item[3],
    }
    const size = Schema.decodeUnknownResult(Schema.Number)(item[13])
    if (Result.isSuccess(size)) {
      result.size = size.success
    }
    return result
  })
}

export const createGoogleDrivePublicFolderNodes = (
  items: readonly GoogleDrivePublicFolderItem[]
): MediaNode[] =>
  items.flatMap<MediaNode>((item) => {
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
    const size = formatFileSize(item.size)
    const baseNode = {
      kind: "playable" as const,
      id: item.id,
      label: item.name,
      url: createGoogleDriveDownloadUrl(item.id),
      status: "unknown" as const,
    }
    const node: MediaNode = size ? { ...baseNode, size } : baseNode
    return [node]
  })

export const extractGoogleDrivePublicFolder = async ({
  targetUrl,
  plugin,
  publicAssetOrigin,
}: PluginAdapterOptions): Promise<ExtractSuccessResponse> => {
  extractGoogleDriveFolderId(targetUrl)
  const response = await fetchValidatedUpstream(targetUrl, {})
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
  const html = await readBoundedUpstreamText(response).catch((error) => {
    if (
      error instanceof Error &&
      error.message === "Upstream response exceeded its byte limit."
    ) {
      throw new Error("Google Drive public folder response is too large.")
    }
    throw error
  })
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
    plugin: createPluginResponseMetadata(plugin, publicAssetOrigin, title),
    nodes: createGoogleDrivePublicFolderNodes(
      parseGoogleDrivePublicFolderItems(html)
    ),
    extensions: {},
  }
}

export const extractGoogleDrivePublicFile = async ({
  targetUrl,
  plugin,
  publicAssetOrigin,
}: PluginAdapterOptions): Promise<ExtractSuccessResponse> => {
  const sourceUrl = new URL(targetUrl)
  const fileId = extractGoogleDriveFileId(sourceUrl)
  const resourceKey = sourceUrl.searchParams.get("resourcekey") ?? undefined
  const downloadUrl = createGoogleDriveDownloadUrl(fileId, resourceKey)
  const metadata = await fetchGoogleDrivePublicFileMetadata(downloadUrl)
  const baseNode = {
    kind: "playable" as const,
    id: fileId,
    label: metadata.filename,
    url: downloadUrl,
    status: "unknown" as const,
  }
  const node: MediaNode = metadata.size
    ? { ...baseNode, size: metadata.size }
    : baseNode
  return {
    plugin: createPluginResponseMetadata(
      plugin,
      publicAssetOrigin,
      metadata.filename
    ),
    nodes: [node],
    extensions: {},
  }
}

export const extractGoogleDrivePublicLink = (
  options: PluginAdapterOptions
): Promise<ExtractSuccessResponse> =>
  GOOGLE_DRIVE_FOLDER_PATH_PATTERN.test(new URL(options.targetUrl).pathname)
    ? extractGoogleDrivePublicFolder(options)
    : extractGoogleDrivePublicFile(options)

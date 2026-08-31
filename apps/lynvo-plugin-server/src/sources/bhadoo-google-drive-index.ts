import type {
  MediaNode,
  ExtractSuccessResponse,
  HttpBasicAuth,
} from "@dg02002/lynvo-plugin-server-protocol"
import { createBasicAuthorization } from "../auth"
import {
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  EXTRACTION_ELAPSED_TIME_LIMIT_MS,
  EXTRACTION_NODE_LIMIT,
  PAGINATION_PAGE_LIMIT,
} from "../constants"
import type { PluginAdapterOptions } from "../plugin-catalog"
import { createPluginResponseMetadata } from "../plugin-catalog"
import { assertSafeUpstreamUrl } from "../url-policy"
import { isVideoFile } from "./video-file"
import { formatFileSize } from "./file-size"
import { extractDirectMedia } from "./direct-media"
import {
  fetchValidatedUpstream,
  readBoundedUpstreamJson,
} from "../upstream-response"
import { Schema } from "effect"

export interface BhadooGoogleDriveItem {
  id: string
  name: string
  mimeType: string
  link?: string | null
  size?: string
}

export interface BhadooGoogleDriveListResponse {
  nextPageToken: string | null
  curPageIndex: number
  data?: { files?: readonly BhadooGoogleDriveItem[] }
  error?: { code?: number; message?: string }
}

const bhadooGoogleDriveItemSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  mimeType: Schema.String,
  link: Schema.optional(Schema.NullOr(Schema.String)),
  size: Schema.optional(Schema.String),
})

const bhadooGoogleDriveListResponseSchema = Schema.Struct({
  nextPageToken: Schema.NullOr(Schema.String),
  curPageIndex: Schema.Number,
  data: Schema.optional(
    Schema.Struct({
      files: Schema.optional(Schema.Array(bhadooGoogleDriveItemSchema)),
    })
  ),
  error: Schema.optional(
    Schema.Struct({
      code: Schema.optional(Schema.Number),
      message: Schema.optional(Schema.String),
    })
  ),
})

export const getBhadooPathFilename = (url: string | URL): string => {
  const parsedUrl = url instanceof URL ? url : new URL(url)
  const finalSegment = parsedUrl.pathname.split("/").filter(Boolean).at(-1)
  return finalSegment ? decodeURIComponent(finalSegment) : "Google Drive Index"
}

export const formatBhadooFileSize = (size?: string): string | undefined => {
  return formatFileSize(size)
}

export const createBhadooNodes = (
  items: readonly BhadooGoogleDriveItem[],
  folderUrl: URL
): MediaNode[] =>
  items.flatMap<MediaNode>((item) => {
    if (item.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE) {
      const pathname = folderUrl.pathname.endsWith("/")
        ? folderUrl.pathname
        : `${folderUrl.pathname}/`
      const nodeUrl = new URL(folderUrl.origin)
      nodeUrl.pathname = `${pathname}${item.name}/`
      return [
        {
          kind: "resolvable" as const,
          id: item.id,
          label: item.name,
          nodeUrl: nodeUrl.toString(),
          resolutionKind: "folder" as const,
        },
      ]
    }
    if (!isVideoFile(item.name)) {
      return []
    }
    const playableUrl = item.link
      ? new URL(item.link, folderUrl)
      : new URL(
          item.name,
          folderUrl.toString().endsWith("/") ? folderUrl : `${folderUrl}/`
        )
    playableUrl.username = ""
    playableUrl.password = ""
    const size = formatBhadooFileSize(item.size)
    const baseNode = {
      kind: "playable" as const,
      id: item.id,
      label: item.name,
      url: playableUrl.toString(),
      status: "unknown" as const,
    }
    const node: MediaNode = size ? { ...baseNode, size } : baseNode
    return [node]
  })

const createAuthorizationHeaders = (
  basicAuth?: HttpBasicAuth
): Record<string, string> =>
  basicAuth
    ? {
        Authorization: createBasicAuthorization(
          basicAuth.username,
          basicAuth.password
        ),
      }
    : {}

const requestBhadooPage = async (
  requestUrl: URL,
  basicAuth: HttpBasicAuth | undefined,
  pageToken: string,
  pageIndex: number
): Promise<BhadooGoogleDriveListResponse> => {
  assertSafeUpstreamUrl(requestUrl.toString())
  const authorizationHeaders = createAuthorizationHeaders(basicAuth)
  const response = await fetchValidatedUpstream(requestUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authorizationHeaders },
    body: JSON.stringify({
      password: "",
      page_token: pageToken,
      page_index: pageIndex,
    }),
  })
  if (!response.ok) {
    throw new Error("Bhadoo Index upstream request failed.")
  }
  return Schema.decodeUnknownSync(bhadooGoogleDriveListResponseSchema)(
    await readBoundedUpstreamJson(response)
  )
}

export const extractBhadooGoogleDriveIndex = async ({
  request,
  targetUrl,
  plugin,
  publicAssetOrigin,
}: PluginAdapterOptions): Promise<ExtractSuccessResponse> => {
  const folderUrl = assertSafeUpstreamUrl(targetUrl)
  folderUrl.username = ""
  folderUrl.password = ""
  if (folderUrl.pathname.toLowerCase().endsWith("/download.aspx")) {
    return extractDirectMedia({
      request,
      targetUrl: folderUrl.toString(),
      plugin,
      publicAssetOrigin,
    })
  }
  const filename = getBhadooPathFilename(folderUrl)
  if (!folderUrl.pathname.endsWith("/") && isVideoFile(filename)) {
    const playableUrl = new URL(folderUrl)
    const actionValues = playableUrl.searchParams.getAll("a")
    playableUrl.searchParams.delete("a")
    actionValues
      .filter((value) => value !== "view")
      .forEach((value) => playableUrl.searchParams.append("a", value))
    return {
      plugin: createPluginResponseMetadata(plugin, publicAssetOrigin, filename),
      nodes: [
        { kind: "playable", label: filename, url: playableUrl.toString() },
      ],
      extensions: {},
    }
  }

  const nodes: MediaNode[] = []
  const seenTokens = new Set<string>()
  const startedAtMs = Date.now()
  let pageToken = ""
  let pageIndex = 0
  do {
    if (
      pageIndex >= PAGINATION_PAGE_LIMIT ||
      Date.now() - startedAtMs >= EXTRACTION_ELAPSED_TIME_LIMIT_MS
    ) {
      throw new Error("Bhadoo Index pagination exceeded its limit.")
    }
    if (pageToken && seenTokens.has(pageToken)) {
      throw new Error("Bhadoo Index repeated a continuation token.")
    }
    if (pageToken) {
      seenTokens.add(pageToken)
    }
    const result = await requestBhadooPage(
      folderUrl,
      request.basicAuth,
      pageToken,
      pageIndex
    )
    if (result.error) {
      throw new Error(
        result.error.message || "Bhadoo Index rejected the request."
      )
    }
    if (!Number.isInteger(result.curPageIndex)) {
      throw new Error("Bhadoo Index returned a malformed page.")
    }
    nodes.push(...createBhadooNodes(result.data?.files ?? [], folderUrl))
    if (nodes.length > EXTRACTION_NODE_LIMIT) {
      throw new Error("Bhadoo Index returned too many nodes.")
    }
    pageToken = result.nextPageToken ?? ""
    pageIndex = result.curPageIndex + 1
  } while (pageToken)

  return {
    plugin: createPluginResponseMetadata(plugin, publicAssetOrigin, filename),
    nodes,
    extensions: {},
  }
}

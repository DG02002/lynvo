import {
  ProtocolError,
  type MediaNode,
  type ExtractSuccessResponse,
  type HttpBasicAuth,
} from "@dg02002/lynvo-plugin-server-protocol"
import { createBasicAuthorization } from "../auth"
import {
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  BHADOO_FALLBACK_API_PATH,
  BHADOO_FALLBACK_PATH,
  EXTRACTION_ELAPSED_TIME_LIMIT_MS,
  EXTRACTION_NODE_LIMIT,
  BHADOO_REVERSE_ENVELOPE_PREFIX_CHARACTER_COUNT,
  BHADOO_REVERSE_ENVELOPE_SUFFIX_CHARACTER_COUNT,
  PAGINATION_PAGE_LIMIT,
} from "../constants"
import {
  createPluginResponseMetadata,
  type PluginAdapterOptions,
} from "../plugin-catalog"
import { assertSafeUpstreamUrl } from "../url-policy"
import { isVideoFile } from "./video-file"
import { formatFileSize } from "./file-size"
import { extractDirectMedia } from "./direct-media"
import {
  fetchValidatedUpstream,
  readBoundedUpstreamJson,
  readBoundedUpstreamText,
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

interface BhadooPageRequestOptions {
  readonly endpointUrl: URL
  readonly fallbackId?: string
  readonly basicAuth?: HttpBasicAuth
  readonly pageToken: string
  readonly pageIndex: number
}

interface BhadooPageRequestBody {
  readonly id?: string
  readonly type?: "folder"
  readonly password: string
  readonly page_token: string
  readonly page_index: number
}

interface BhadooFallbackItemRequestOptions {
  readonly endpointUrl: URL
  readonly fallbackId: string
  readonly basicAuth?: HttpBasicAuth
}

interface BhadooFolderTarget {
  readonly endpointUrl: URL
  readonly fallbackId?: string
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

const isBhadooFallbackUrl = (url: URL): boolean =>
  url.pathname.toLowerCase() === BHADOO_FALLBACK_PATH

const createBhadooFolderNodeUrl = (
  folderUrl: URL,
  item: BhadooGoogleDriveItem
): string => {
  if (isBhadooFallbackUrl(folderUrl)) {
    const nodeUrl = new URL(folderUrl.origin)
    nodeUrl.pathname = BHADOO_FALLBACK_PATH
    nodeUrl.searchParams.set("id", item.id)
    return nodeUrl.toString()
  }

  const pathname = folderUrl.pathname.endsWith("/")
    ? folderUrl.pathname
    : `${folderUrl.pathname}/`
  const nodeUrl = new URL(folderUrl.origin)
  nodeUrl.pathname = `${pathname}${item.name}/`
  return nodeUrl.toString()
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
      return [
        {
          kind: "resolvable" as const,
          id: item.id,
          label: item.name,
          nodeUrl: createBhadooFolderNodeUrl(folderUrl, item),
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

export const decodeBhadooReverseEnvelope = (
  encodedResponse: string
): BhadooGoogleDriveListResponse => {
  const reversedResponse = encodedResponse.split("").reverse().join("")
  const base64Response = reversedResponse
    .slice(BHADOO_REVERSE_ENVELOPE_PREFIX_CHARACTER_COUNT)
    .slice(0, -BHADOO_REVERSE_ENVELOPE_SUFFIX_CHARACTER_COUNT)
  const responseBytes = Uint8Array.from(atob(base64Response), (character) =>
    character.charCodeAt(0)
  )
  return Schema.decodeUnknownSync(bhadooGoogleDriveListResponseSchema)(
    JSON.parse(new TextDecoder().decode(responseBytes))
  )
}

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

const createBhadooPageRequestBody = (
  fallbackId: string | undefined,
  pageToken: string,
  pageIndex: number
): BhadooPageRequestBody =>
  fallbackId
    ? {
        id: fallbackId,
        type: "folder",
        password: "",
        page_token: pageToken,
        page_index: pageIndex,
      }
    : {
        password: "",
        page_token: pageToken,
        page_index: pageIndex,
      }

const createBhadooPageFormBody = (
  fallbackId: string | undefined,
  pageToken: string,
  pageIndex: number
): string => {
  const body = new URLSearchParams()
  if (fallbackId) {
    body.set("id", fallbackId)
    body.set("type", "folder")
  }
  body.set("password", "")
  body.set("page_token", pageToken)
  body.set("page_index", String(pageIndex))
  return body.toString()
}

const createBhadooFolderTarget = (folderUrl: URL): BhadooFolderTarget => {
  if (!isBhadooFallbackUrl(folderUrl)) {
    return { endpointUrl: folderUrl }
  }

  const fallbackId = folderUrl.searchParams.get("id")
  if (!fallbackId) {
    throw new ProtocolError(
      "UNSUPPORTED_URL",
      "Bhadoo fallback URL does not contain a folder id."
    )
  }

  const endpointUrl = new URL(folderUrl)
  endpointUrl.pathname = BHADOO_FALLBACK_API_PATH
  endpointUrl.search = ""
  endpointUrl.hash = ""
  return { endpointUrl, fallbackId }
}

const requestBhadooPage = async ({
  endpointUrl,
  fallbackId,
  basicAuth,
  pageToken,
  pageIndex,
}: BhadooPageRequestOptions): Promise<BhadooGoogleDriveListResponse> => {
  assertSafeUpstreamUrl(endpointUrl.toString())
  const authorizationHeaders = createAuthorizationHeaders(basicAuth)
  const jsonResponse = await fetchValidatedUpstream(endpointUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authorizationHeaders },
    body: JSON.stringify(
      createBhadooPageRequestBody(fallbackId, pageToken, pageIndex)
    ),
  })
  if (jsonResponse.ok) {
    return Schema.decodeUnknownSync(bhadooGoogleDriveListResponseSchema)(
      await readBoundedUpstreamJson(jsonResponse)
    )
  }
  await jsonResponse.body?.cancel()

  // HACK: Deployed Bhadoo indexes can require this reverse-envelope POST.
  // Keep this active protocol until those deployments are retired.
  const reverseEnvelopeResponse = await fetchValidatedUpstream(endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      ...authorizationHeaders,
    },
    body: createBhadooPageFormBody(fallbackId, pageToken, pageIndex),
  })
  if (!reverseEnvelopeResponse.ok) {
    throw new Error(
      `Bhadoo Index upstream request failed (JSON ${jsonResponse.status}; reverse envelope ${reverseEnvelopeResponse.status}).`
    )
  }
  return decodeBhadooReverseEnvelope(
    await readBoundedUpstreamText(reverseEnvelopeResponse)
  )
}

const requestBhadooFallbackItem = async ({
  endpointUrl,
  fallbackId,
  basicAuth,
}: BhadooFallbackItemRequestOptions): Promise<BhadooGoogleDriveItem> => {
  assertSafeUpstreamUrl(endpointUrl.toString())
  const response = await fetchValidatedUpstream(endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...createAuthorizationHeaders(basicAuth),
    },
    body: JSON.stringify({ id: fallbackId }),
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`Bhadoo fallback item request failed (${response.status}).`)
  }
  return Schema.decodeUnknownSync(bhadooGoogleDriveItemSchema)(
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
  const folderTarget = createBhadooFolderTarget(folderUrl)
  if (folderUrl.pathname.toLowerCase().endsWith("/download.aspx")) {
    return extractDirectMedia({
      request,
      targetUrl: folderUrl.toString(),
      plugin,
      publicAssetOrigin,
    })
  }
  const fallbackItem = folderTarget.fallbackId
    ? await requestBhadooFallbackItem({
        endpointUrl: folderTarget.endpointUrl,
        fallbackId: folderTarget.fallbackId,
        basicAuth: request.basicAuth,
      })
    : undefined
  if (fallbackItem && folderUrl.searchParams.has("a")) {
    return {
      plugin: createPluginResponseMetadata(
        plugin,
        publicAssetOrigin,
        fallbackItem.name
      ),
      nodes: createBhadooNodes([fallbackItem], folderUrl),
      extensions: {},
    }
  }
  const filename = getBhadooPathFilename(folderUrl)
  const pageTitle = fallbackItem?.name ?? filename
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
    const result = await requestBhadooPage({
      endpointUrl: folderTarget.endpointUrl,
      fallbackId: folderTarget.fallbackId,
      basicAuth: request.basicAuth,
      pageToken,
      pageIndex,
    })
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
    plugin: createPluginResponseMetadata(plugin, publicAssetOrigin, pageTitle),
    nodes,
    extensions: {},
  }
}

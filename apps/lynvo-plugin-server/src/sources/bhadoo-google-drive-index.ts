import {
  ProtocolError,
  type MediaNode,
  type ExtractSuccessResponse,
  type HttpBasicAuth,
} from "@dg02002/lynvo-plugin-server-protocol"
import { Schema } from "effect"

import { createBasicAuthorization } from "../auth"
import {
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  BHADOO_FALLBACK_API_PATH,
  BHADOO_FALLBACK_PATH,
  BHADOO_REVERSE_ENVELOPE_PREFIX_CHARACTER_COUNT,
  BHADOO_REVERSE_ENVELOPE_SUFFIX_CHARACTER_COUNT,
} from "../constants"
import {
  createPluginResponseMetadata,
  getSourceRequestContext,
  type PluginAdapterOptions,
  type SourceRequestContext,
} from "../plugin-adapter"
import {
  cancelUpstreamResponseBody,
  readBoundedUpstreamJson,
  readBoundedUpstreamText,
} from "../upstream-response"
import { assertSafeUpstreamUrl, encodeUrlPathSegment } from "../url-policy"
import { extractDirectMedia } from "./direct-media"
import { fetchWithSourceRetries } from "./fetch-with-retries"
import { formatFileSize } from "./file-size"
import { getLastPathSegment } from "./media-metadata"
import {
  createSourceFolderNodes,
  type SourceFolderNodeInput,
} from "./media-node"
import { paginateUpstream, type UpstreamPage } from "./pagination"
import { isVideoFile } from "./video-file"

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

interface BhadooPageRequestOptions extends SourceRequestContext {
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

interface BhadooFallbackItemRequestOptions extends SourceRequestContext {
  readonly endpointUrl: URL
  readonly fallbackId: string
  readonly basicAuth?: HttpBasicAuth
}

interface BhadooFolderTarget {
  readonly endpointUrl: URL
  readonly fallbackId?: string
}

interface BhadooPaginationOptions extends SourceRequestContext {
  readonly endpointUrl: URL
  readonly fallbackId?: string
  readonly basicAuth?: HttpBasicAuth
  readonly folderUrl: URL
}

interface BhadooFileResponseOptions {
  readonly filename: string
  readonly folderUrl: URL
  readonly plugin: PluginAdapterOptions["plugin"]
  readonly publicAssetOrigin?: string
}

const createReplaySafeBhadooRequestOptions = (
  sourceRequestContext: SourceRequestContext
) => ({
  ...sourceRequestContext,
  requestReplaySafe: true,
})

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
  return getLastPathSegment(parsedUrl.pathname, "Google Drive Index")
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
  nodeUrl.pathname = `${pathname}${encodeUrlPathSegment(item.name)}/`
  return nodeUrl.toString()
}

export const formatBhadooFileSize = (size?: string): string | undefined => {
  return formatFileSize(size)
}

export const createBhadooNodes = (
  items: readonly BhadooGoogleDriveItem[],
  folderUrl: URL
): MediaNode[] =>
  createSourceFolderNodes(
    items.flatMap<SourceFolderNodeInput>((item) => {
      if (item.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE) {
        return [
          {
            kind: "folder",
            id: item.id,
            label: item.name,
            nodeUrl: createBhadooFolderNodeUrl(folderUrl, item),
          },
        ]
      }
      if (!isVideoFile(item.name)) {
        return []
      }
      const size = formatBhadooFileSize(item.size)
      const playableUrl = item.link
        ? new URL(item.link, folderUrl)
        : new URL(
            encodeUrlPathSegment(item.name),
            folderUrl.toString().endsWith("/") ? folderUrl : `${folderUrl}/`
          )
      playableUrl.username = ""
      playableUrl.password = ""
      return [
        {
          kind: "file",
          id: item.id,
          label: item.name,
          mediaUrl: playableUrl.toString(),
          size,
          // The index supplies the final URL but does not expose a safe probe
          // endpoint, so range capability remains unknown.
          rangeRequest: "unknown",
        },
      ]
    })
  )

const decodeBhadooReverseEnvelope = (
  encodedResponse: string
): BhadooGoogleDriveListResponse => {
  const reversedResponse = encodedResponse.split("").toReversed().join("")
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

// Bhadoo encodes read-only listing operations in POST bodies, so bounded retries are safe.
const requestBhadooPage = async ({
  endpointUrl,
  fallbackId,
  basicAuth,
  pageToken,
  pageIndex,
  retry,
  startedAtMs,
}: BhadooPageRequestOptions): Promise<BhadooGoogleDriveListResponse> => {
  const requestRetryOptions = createReplaySafeBhadooRequestOptions({
    retry,
    startedAtMs,
  })
  const authorizationHeaders = createAuthorizationHeaders(basicAuth)
  const jsonResponse = await fetchWithSourceRetries(
    endpointUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authorizationHeaders },
      body: JSON.stringify(
        createBhadooPageRequestBody(fallbackId, pageToken, pageIndex)
      ),
    },
    requestRetryOptions
  )
  if (jsonResponse.ok) {
    return Schema.decodeUnknownSync(bhadooGoogleDriveListResponseSchema)(
      await readBoundedUpstreamJson(jsonResponse)
    )
  }
  await cancelUpstreamResponseBody(jsonResponse)

  // HACK: Deployed Bhadoo indexes can require this reverse-envelope POST.
  // Keep this active protocol until those deployments are retired.
  const reverseEnvelopeResponse = await fetchWithSourceRetries(
    endpointUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        ...authorizationHeaders,
      },
      body: createBhadooPageFormBody(fallbackId, pageToken, pageIndex),
    },
    requestRetryOptions
  )
  if (!reverseEnvelopeResponse.ok) {
    await cancelUpstreamResponseBody(reverseEnvelopeResponse)
    throw new Error(
      `Bhadoo Index upstream request failed (JSON ${jsonResponse.status}; reverse envelope ${reverseEnvelopeResponse.status}).`
    )
  }
  return decodeBhadooReverseEnvelope(
    await readBoundedUpstreamText(reverseEnvelopeResponse)
  )
}

// This POST retrieves a listed item and does not mutate the index.
const requestBhadooFallbackItem = async ({
  endpointUrl,
  fallbackId,
  basicAuth,
  retry,
  startedAtMs,
}: BhadooFallbackItemRequestOptions): Promise<BhadooGoogleDriveItem> => {
  const requestRetryOptions = createReplaySafeBhadooRequestOptions({
    retry,
    startedAtMs,
  })
  const response = await fetchWithSourceRetries(
    endpointUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...createAuthorizationHeaders(basicAuth),
      },
      body: JSON.stringify({ id: fallbackId }),
    },
    requestRetryOptions
  )
  if (!response.ok) {
    await cancelUpstreamResponseBody(response)
    throw new Error(`Bhadoo fallback item request failed (${response.status}).`)
  }
  return Schema.decodeUnknownSync(bhadooGoogleDriveItemSchema)(
    await readBoundedUpstreamJson(response)
  )
}

const createBhadooFileResponse = ({
  filename,
  folderUrl,
  plugin,
  publicAssetOrigin,
}: BhadooFileResponseOptions): ExtractSuccessResponse => {
  const playableUrl = new URL(folderUrl)
  const actionValues = playableUrl.searchParams.getAll("a")
  playableUrl.searchParams.delete("a")
  actionValues
    .filter((value) => value !== "view")
    .forEach((value) => playableUrl.searchParams.append("a", value))
  return {
    plugin: createPluginResponseMetadata(plugin, publicAssetOrigin, filename),
    nodes: [{ kind: "playable", label: filename, url: playableUrl.toString() }],
    extensions: {},
  }
}

const fetchBhadooNodes = async ({
  endpointUrl,
  fallbackId,
  basicAuth,
  folderUrl,
  retry,
  startedAtMs,
}: BhadooPaginationOptions): Promise<MediaNode[]> => {
  const sourceRequestContext = { retry, startedAtMs }
  let nextPageIndex = 0
  const fetchPage = async (
    pageToken: string
  ): Promise<UpstreamPage<BhadooGoogleDriveListResponse>> => {
    const result = await requestBhadooPage({
      endpointUrl,
      fallbackId,
      basicAuth,
      pageToken,
      pageIndex: nextPageIndex,
      ...sourceRequestContext,
    })
    if (result.error) {
      throw new Error(
        result.error.message || "Bhadoo Index rejected the request."
      )
    }
    if (!Number.isInteger(result.curPageIndex)) {
      throw new Error("Bhadoo Index returned a malformed page.")
    }
    nextPageIndex = result.curPageIndex + 1
    return {
      value: result,
      nextToken: result.nextPageToken ?? undefined,
    }
  }

  return paginateUpstream(
    fetchPage,
    (result) => createBhadooNodes(result.data?.files ?? [], folderUrl),
    {
      sourceName: "Bhadoo Index",
      startedAtMs: sourceRequestContext.startedAtMs,
    }
  )
}

export const extractBhadooGoogleDriveIndex = async ({
  request,
  targetUrl,
  plugin,
  publicAssetOrigin,
  sourceRequestContext: providedSourceRequestContext,
}: PluginAdapterOptions): Promise<ExtractSuccessResponse> => {
  const sourceRequestContext = getSourceRequestContext(
    plugin,
    providedSourceRequestContext
  )
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
      sourceRequestContext,
    })
  }
  const fallbackItem = folderTarget.fallbackId
    ? await requestBhadooFallbackItem({
        endpointUrl: folderTarget.endpointUrl,
        fallbackId: folderTarget.fallbackId,
        basicAuth: request.basicAuth,
        ...sourceRequestContext,
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
    return createBhadooFileResponse({
      filename,
      folderUrl,
      plugin,
      publicAssetOrigin,
    })
  }

  const nodes = await fetchBhadooNodes({
    endpointUrl: folderTarget.endpointUrl,
    fallbackId: folderTarget.fallbackId,
    basicAuth: request.basicAuth,
    folderUrl,
    ...sourceRequestContext,
  })

  return {
    plugin: createPluginResponseMetadata(plugin, publicAssetOrigin, pageTitle),
    nodes,
    extensions: {},
  }
}

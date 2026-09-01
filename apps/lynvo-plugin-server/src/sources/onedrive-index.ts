import { load } from "cheerio"
import {
  ProtocolError,
  type MediaNode,
  type ExtractSuccessResponse,
} from "@dg02002/lynvo-plugin-server-protocol"
import {
  ONEDRIVE_FETCH_RETRIES,
  ONEDRIVE_FETCH_RETRY_DELAY_MS,
  EXTRACTION_ELAPSED_TIME_LIMIT_MS,
  EXTRACTION_NODE_LIMIT,
  PAGINATION_PAGE_LIMIT,
} from "../constants"
import {
  createPluginResponseMetadata,
  type PluginAdapterOptions,
} from "../plugin-catalog"
import { assertSafeUpstreamUrl } from "../url-policy"
import { isVideoFile } from "./video-file"
import { formatFileSize } from "./file-size"
import {
  fetchValidatedUpstream,
  readBoundedUpstreamJson,
  readBoundedUpstreamText,
  UpstreamPolicyError,
} from "../upstream-response"
import { Result, Schema } from "effect"

export interface OneDriveItem {
  readonly name: string
  readonly id: string
  readonly folder?: unknown
  readonly file?: unknown
  readonly size?: string | number
}

export interface OneDriveApiResponse {
  readonly folder?: { readonly value: readonly OneDriveItem[] }
  readonly file?: OneDriveItem
  readonly next?: string
  readonly error?: string
}

export interface OneDriveNodeOptions {
  readonly items: readonly OneDriveItem[]
  readonly currentPath: string
  readonly origin: string
  readonly hashedPassword: string
}

interface OneDrivePageOptions {
  readonly origin: string
  readonly path: string
  readonly headers: HeadersInit
  readonly hashedPassword: string
  readonly initialToken?: string
  readonly startedAtMs?: number
}

interface OneDrivePageRequestOptions {
  readonly origin: string
  readonly path: string
  readonly nextToken: string
  readonly headers: HeadersInit
}

interface OneDriveResponseNodeOptions {
  readonly result: OneDriveApiResponse
  readonly path: string
  readonly origin: string
  readonly hashedPassword: string
}

interface OneDriveInitialResponseOptions {
  readonly response: Response
  readonly path: string
  readonly origin: string
  readonly headers: HeadersInit
  readonly hashedPassword: string
  readonly startedAtMs: number
}

const oneDriveItemSchema: Schema.Codec<OneDriveItem> = Schema.Struct({
  name: Schema.String,
  id: Schema.String,
  folder: Schema.optional(Schema.Unknown),
  file: Schema.optional(Schema.Unknown),
  size: Schema.optional(Schema.Union([Schema.String, Schema.Number])),
})

const oneDriveApiResponseSchema: Schema.Codec<OneDriveApiResponse> =
  Schema.Struct({
    folder: Schema.optional(
      Schema.Struct({ value: Schema.Array(oneDriveItemSchema) })
    ),
    file: Schema.optional(oneDriveItemSchema),
    next: Schema.optional(Schema.String),
    error: Schema.optional(Schema.String),
  })

const oneDriveNextDataSchema = Schema.Struct({
  props: Schema.Struct({ pageProps: oneDriveApiResponseSchema }),
})

const passwordRequiredResponseSchema = Schema.Struct({
  error: Schema.Literal("Password required."),
})

export const sha256 = async (message: string): Promise<string> => {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(message)
  )
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

const wait = (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs))

export const fetchOneDrive = async (
  targetUrl: string,
  options: RequestInit,
  attempt = 0
): Promise<Response> => {
  assertSafeUpstreamUrl(targetUrl)
  try {
    const response = await fetchValidatedUpstream(targetUrl, options)
    if (
      !response.ok &&
      response.status !== 401 &&
      (response.status === 429 || response.status >= 500) &&
      attempt < ONEDRIVE_FETCH_RETRIES - 1
    ) {
      await wait(ONEDRIVE_FETCH_RETRY_DELAY_MS)
      return fetchOneDrive(targetUrl, options, attempt + 1)
    }
    return response
  } catch (error) {
    if (error instanceof UpstreamPolicyError) {
      throw error
    }
    if (attempt >= ONEDRIVE_FETCH_RETRIES - 1) {
      throw error
    }
    await wait(ONEDRIVE_FETCH_RETRY_DELAY_MS)
    return fetchOneDrive(targetUrl, options, attempt + 1)
  }
}

export const encodeOneDrivePath = (path: string): string =>
  path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")

export const createOneDriveNodes = ({
  items,
  currentPath,
  origin,
  hashedPassword,
}: OneDriveNodeOptions): MediaNode[] =>
  items.flatMap<MediaNode>((item) => {
    if (item.folder) {
      const nextPath = currentPath.endsWith("/")
        ? currentPath + item.name
        : `${currentPath}/${item.name}`
      return [
        {
          kind: "resolvable" as const,
          id: item.id,
          label: item.name,
          nodeUrl: `${origin}${encodeOneDrivePath(nextPath)}`,
          resolutionKind: "folder" as const,
        },
      ]
    }

    if (!item.file || !isVideoFile(item.name)) {
      return []
    }

    const size = formatFileSize(item.size)
    const fullPath = currentPath.endsWith("/")
      ? currentPath + item.name
      : `${currentPath}/${item.name}`
    const playableUrl = new URL("/api/raw/", origin)
    playableUrl.searchParams.set("path", fullPath)
    if (hashedPassword) {
      playableUrl.searchParams.set("odpt", hashedPassword)
    }
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

export const extractOneDriveNextData = (
  html: string
): OneDriveApiResponse | undefined => {
  const document = load(html)
  const nextData = document("#__NEXT_DATA__").html()
  if (!nextData) {
    return undefined
  }
  const parsed = Schema.decodeUnknownResult(oneDriveNextDataSchema)(
    JSON.parse(nextData)
  )
  return Result.isSuccess(parsed) ? parsed.success.props.pageProps : undefined
}

const readOneDrivePage = async ({
  origin,
  path,
  nextToken,
  headers,
}: OneDrivePageRequestOptions): Promise<OneDriveApiResponse> => {
  const apiUrl = new URL("/api", origin)
  apiUrl.searchParams.set("path", path)
  if (nextToken) {
    apiUrl.searchParams.set("next", nextToken)
  }
  const response = await fetchOneDrive(apiUrl.toString(), { headers })
  if (response.status === 401) {
    const errorBody = await readBoundedUpstreamJson(response).catch(
      () => undefined
    )
    const parsedPasswordError = Schema.decodeUnknownResult(
      passwordRequiredResponseSchema
    )(errorBody)
    if (Result.isSuccess(parsedPasswordError)) {
      throw new ProtocolError(
        "PASSWORD_REQUIRED",
        "Password is required for this resource."
      )
    }
    throw new ProtocolError(
      "INVALID_PASSWORD",
      "The supplied password was rejected."
    )
  }
  if (!response.ok) {
    throw new Error("OneDrive Index upstream request failed.")
  }
  const data = Schema.decodeUnknownResult(oneDriveApiResponseSchema)(
    await readBoundedUpstreamJson(response)
  )
  if (Result.isFailure(data)) {
    throw new Error("OneDrive Index returned malformed JSON.")
  }
  return data.success
}

const createOneDriveResponseNodes = ({
  result,
  path,
  origin,
  hashedPassword,
}: OneDriveResponseNodeOptions): MediaNode[] => {
  if (result.folder && Array.isArray(result.folder.value)) {
    return createOneDriveNodes({
      items: result.folder.value,
      currentPath: path,
      origin,
      hashedPassword,
    })
  }
  if (result.file) {
    const parentPath = path.slice(0, Math.max(0, path.lastIndexOf("/")))
    return createOneDriveNodes({
      items: [result.file],
      currentPath: parentPath,
      origin,
      hashedPassword,
    })
  }
  throw new Error("OneDrive Index returned an unsupported payload.")
}

const fetchOneDrivePage = async ({
  origin,
  path,
  headers,
  hashedPassword,
  initialToken = "",
  startedAtMs = Date.now(),
}: OneDrivePageOptions): Promise<MediaNode[]> => {
  const nodes: MediaNode[] = []
  const seenTokens = new Set<string>()
  const fetchPage = async (
    nextToken: string,
    pageCount: number
  ): Promise<void> => {
    if (
      pageCount >= PAGINATION_PAGE_LIMIT ||
      Date.now() - startedAtMs >= EXTRACTION_ELAPSED_TIME_LIMIT_MS
    ) {
      throw new Error("OneDrive Index pagination exceeded its limit.")
    }
    if (nextToken && seenTokens.has(nextToken)) {
      throw new Error("OneDrive Index repeated a continuation token.")
    }
    if (nextToken) {
      seenTokens.add(nextToken)
    }
    const result = await readOneDrivePage({
      origin,
      path,
      nextToken,
      headers,
    })
    nodes.push(
      ...createOneDriveResponseNodes({
        result,
        path,
        origin,
        hashedPassword,
      })
    )
    if (nodes.length > EXTRACTION_NODE_LIMIT) {
      throw new Error("OneDrive Index returned too many nodes.")
    }
    const continuationToken = result.next ?? ""
    if (continuationToken) {
      await fetchPage(continuationToken, pageCount + 1)
    }
  }
  await fetchPage(initialToken, 0)
  return nodes
}

const extractOneDriveInitialNodes = async ({
  response,
  path,
  origin,
  headers,
  hashedPassword,
  startedAtMs,
}: OneDriveInitialResponseOptions): Promise<MediaNode[] | undefined> => {
  const nextData = extractOneDriveNextData(
    await readBoundedUpstreamText(response)
  )
  if (nextData?.folder && Array.isArray(nextData.folder.value)) {
    const nodes = createOneDriveNodes({
      items: nextData.folder.value,
      currentPath: path,
      origin,
      hashedPassword,
    })
    if (nextData.next) {
      nodes.push(
        ...(await fetchOneDrivePage({
          origin,
          path,
          headers,
          hashedPassword,
          initialToken: nextData.next,
          startedAtMs,
        }))
      )
    }
    return nodes
  }
  if (nextData?.file) {
    const parentPath = path.slice(0, Math.max(0, path.lastIndexOf("/")))
    return createOneDriveNodes({
      items: [nextData.file],
      currentPath: parentPath,
      origin,
      hashedPassword,
    })
  }
  return undefined
}

export const extractOneDriveIndex = async ({
  request,
  targetUrl,
  plugin,
  publicAssetOrigin,
}: PluginAdapterOptions): Promise<ExtractSuccessResponse> => {
  const parsedUrl = assertSafeUpstreamUrl(targetUrl)
  const path = decodeURIComponent(parsedUrl.pathname)
  const password = request.password ?? ""
  const hashedPassword = password ? await sha256(password) : ""
  const headers = hashedPassword
    ? { "od-protected-token": hashedPassword }
    : undefined
  const requestHeaders = headers ?? {}
  const startedAtMs = Date.now()

  const initialResponse = await fetchOneDrive(parsedUrl.toString(), {
    headers,
  })
  if (initialResponse.status === 401) {
    throw new Error(password ? "INVALID_PASSWORD" : "PASSWORD_REQUIRED")
  }
  let nodes = initialResponse.ok
    ? await extractOneDriveInitialNodes({
        response: initialResponse,
        path,
        origin: parsedUrl.origin,
        headers: requestHeaders,
        hashedPassword,
        startedAtMs,
      })
    : undefined
  nodes ??= await fetchOneDrivePage({
    origin: parsedUrl.origin,
    path,
    headers: requestHeaders,
    hashedPassword,
    startedAtMs,
  })
  const pageTitle = decodeURIComponent(
    parsedUrl.pathname
      .split("/")
      .findLast((pathSegment) => pathSegment.length > 0) ?? "OneDrive Index"
  )
  return {
    plugin: createPluginResponseMetadata(plugin, publicAssetOrigin, pageTitle),
    nodes,
    extensions: {},
  }
}

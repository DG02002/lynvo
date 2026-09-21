import {
  ProtocolError,
  runWithRetries,
  type MediaNode,
  type ExtractSuccessResponse,
} from "@dg02002/lynvo-plugin-server-protocol"
import { load } from "cheerio"
import { Result, Schema } from "effect"

import {
  ONEDRIVE_FETCH_RETRIES,
  ONEDRIVE_FETCH_RETRY_DELAY_MS,
} from "../constants"
import {
  createPluginResponseMetadata,
  type PluginAdapterOptions,
} from "../plugin-adapter"
import {
  fetchValidatedUpstream,
  readBoundedUpstreamJson,
  readBoundedUpstreamText,
  UpstreamPolicyError,
} from "../upstream-response"
import {
  assertSafeUpstreamUrl,
  decodeUrlComponent,
  encodeUrlPathSegment,
} from "../url-policy"
import { formatFileSize } from "./file-size"
import { createSourcePlayableNode } from "./media-node"
import { paginateUpstream, type UpstreamPage } from "./pagination"
import { isVideoFile } from "./video-file"

interface OneDriveItem {
  readonly name: string
  readonly id: string
  readonly folder?: unknown
  readonly file?: unknown
  readonly size?: string | number
}

interface OneDriveApiResponse {
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

const sha256 = async (message: string): Promise<string> => {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(message)
  )
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

const fetchOneDrive = async (
  targetUrl: string,
  options: RequestInit
): Promise<Response> => {
  assertSafeUpstreamUrl(targetUrl)
  return runWithRetries(() => fetchValidatedUpstream(targetUrl, options), {
    maxRetries: ONEDRIVE_FETCH_RETRIES - 1,
    decide: (outcome) => {
      if (outcome._tag === "failure") {
        return outcome.cause instanceof UpstreamPolicyError
          ? { retry: false }
          : { retry: true, delayMs: ONEDRIVE_FETCH_RETRY_DELAY_MS }
      }
      const { status } = outcome.value
      return !outcome.value.ok &&
        status !== 401 &&
        (status === 429 || status >= 500)
        ? { retry: true, delayMs: ONEDRIVE_FETCH_RETRY_DELAY_MS }
        : { retry: false }
    },
  })
}

const encodeOneDrivePath = (path: string): string =>
  path.split("/").map(encodeUrlPathSegment).join("/")

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
    const node = createSourcePlayableNode({
      id: item.id,
      label: item.name,
      url: playableUrl.toString(),
      size,
    })
    return [node]
  })

const extractOneDriveNextData = (
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

const passwordRequiredError = (): ProtocolError =>
  new ProtocolError(
    "PASSWORD_REQUIRED",
    "Password is required for this resource."
  )

const invalidPasswordError = (): ProtocolError =>
  new ProtocolError("INVALID_PASSWORD", "The supplied password was rejected.")

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
      throw passwordRequiredError()
    }
    throw invalidPasswordError()
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
  const fetchPage = async (
    nextToken: string
  ): Promise<UpstreamPage<OneDriveApiResponse>> => {
    const result = await readOneDrivePage({
      origin,
      path,
      nextToken,
      headers,
    })
    return {
      value: result,
      nextToken: result.next,
    }
  }

  return paginateUpstream(
    fetchPage,
    (result) =>
      createOneDriveResponseNodes({
        result,
        path,
        origin,
        hashedPassword,
      }),
    {
      sourceName: "OneDrive Index",
      initialToken,
      startedAtMs,
    }
  )
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
  const path = decodeUrlComponent(parsedUrl.pathname)
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
    throw password ? invalidPasswordError() : passwordRequiredError()
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
  const pageTitle = decodeUrlComponent(
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

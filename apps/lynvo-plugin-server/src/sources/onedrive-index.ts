import { load } from "cheerio"
import type {
  MediaNode,
  ExtractSuccessResponse,
} from "@dg02002/lynvo-plugin-server-protocol"
import {
  ONEDRIVE_FETCH_RETRIES,
  ONEDRIVE_FETCH_RETRY_DELAY_MS,
  EXTRACTION_ELAPSED_TIME_LIMIT_MS,
  EXTRACTION_NODE_LIMIT,
  PAGINATION_PAGE_LIMIT,
} from "../constants"
import type { PluginAdapterOptions } from "../plugin-catalog"
import { createPluginResponseMetadata } from "../plugin-catalog"
import { assertSafeUpstreamUrl } from "../url-policy"
import { isVideoFile } from "./video-file"
import { formatFileSize } from "./file-size"
import {
  fetchValidatedUpstream,
  readBoundedUpstreamJson,
  readBoundedUpstreamText,
  UpstreamPolicyError,
} from "../upstream-response"
import { z } from "zod"

export interface OneDriveItem {
  name: string
  id: string
  folder?: unknown
  file?: unknown
  size?: string | number
}

export interface OneDriveApiResponse {
  folder?: { value: OneDriveItem[] }
  file?: OneDriveItem
  next?: string
  error?: string
}

const oneDriveItemSchema = z.object({
  name: z.string(),
  id: z.string(),
  folder: z.json().optional(),
  file: z.json().optional(),
  size: z.union([z.string(), z.number()]).optional(),
})

const oneDriveApiResponseSchema = z.object({
  folder: z.object({ value: z.array(oneDriveItemSchema) }).optional(),
  file: oneDriveItemSchema.optional(),
  next: z.string().optional(),
  error: z.string().optional(),
})

const oneDriveNextDataSchema = z.object({
  props: z.object({ pageProps: oneDriveApiResponseSchema }),
})

const passwordRequiredResponseSchema = z.object({
  error: z.literal("Password required."),
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

export const createOneDriveNodes = (
  items: readonly OneDriveItem[],
  currentPath: string,
  origin: string,
  hashedPassword: string
): MediaNode[] =>
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
    const node: MediaNode = {
      kind: "playable" as const,
      id: item.id,
      label: item.name,
      url: playableUrl.toString(),
      status: "unknown" as const,
    }
    if (size) {
      node.size = size
    }
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
  const parsed = oneDriveNextDataSchema.safeParse(JSON.parse(nextData))
  return parsed.success ? parsed.data.props.pageProps : undefined
}

const fetchOneDrivePage = async (
  origin: string,
  path: string,
  headers: HeadersInit,
  hashedPassword: string,
  initialToken = "",
  startedAtMs = Date.now()
): Promise<MediaNode[]> => {
  const nodes: MediaNode[] = []
  const seenTokens = new Set<string>()
  let nextToken = initialToken
  let pageCount = 0
  do {
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
    pageCount += 1
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
      if (passwordRequiredResponseSchema.safeParse(errorBody).success) {
        throw new Error("PASSWORD_REQUIRED")
      }
      throw new Error("INVALID_PASSWORD")
    }
    if (!response.ok) {
      throw new Error("OneDrive Index upstream request failed.")
    }
    const data = oneDriveApiResponseSchema.safeParse(
      await readBoundedUpstreamJson(response)
    )
    if (!data.success) {
      throw new Error("OneDrive Index returned malformed JSON.")
    }
    const result = data.data
    if (result.folder && Array.isArray(result.folder.value)) {
      nodes.push(
        ...createOneDriveNodes(
          result.folder.value,
          path,
          origin,
          hashedPassword
        )
      )
    } else if (result.file) {
      const parentPath = path.slice(0, Math.max(0, path.lastIndexOf("/")))
      nodes.push(
        ...createOneDriveNodes(
          [result.file],
          parentPath,
          origin,
          hashedPassword
        )
      )
    } else {
      throw new Error("OneDrive Index returned an unsupported payload.")
    }
    nextToken = result.next ?? ""
    if (nodes.length > EXTRACTION_NODE_LIMIT) {
      throw new Error("OneDrive Index returned too many nodes.")
    }
  } while (nextToken)
  return nodes
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
  let nodes: MediaNode[] | undefined
  const startedAtMs = Date.now()

  const initialResponse = await fetchOneDrive(parsedUrl.toString(), { headers })
  if (initialResponse.status === 401) {
    throw new Error(password ? "INVALID_PASSWORD" : "PASSWORD_REQUIRED")
  }
  if (initialResponse.ok) {
    const nextData = extractOneDriveNextData(
      await readBoundedUpstreamText(initialResponse)
    )
    if (nextData?.folder && Array.isArray(nextData.folder.value)) {
      nodes = createOneDriveNodes(
        nextData.folder.value,
        path,
        parsedUrl.origin,
        hashedPassword
      )
      if (nextData.next) {
        nodes.push(
          ...(await fetchOneDrivePage(
            parsedUrl.origin,
            path,
            headers ?? {},
            hashedPassword,
            nextData.next,
            startedAtMs
          ))
        )
      }
    } else if (nextData?.file) {
      const parentPath = path.slice(0, Math.max(0, path.lastIndexOf("/")))
      nodes = createOneDriveNodes(
        [nextData.file],
        parentPath,
        parsedUrl.origin,
        hashedPassword
      )
    }
  }

  nodes ??= await fetchOneDrivePage(
    parsedUrl.origin,
    path,
    headers ?? {},
    hashedPassword,
    "",
    startedAtMs
  )
  const pageTitle = decodeURIComponent(
    parsedUrl.pathname.split("/").filter(Boolean).at(-1) ?? "OneDrive Index"
  )
  return {
    plugin: createPluginResponseMetadata(plugin, publicAssetOrigin, pageTitle),
    nodes,
    extensions: {},
  }
}

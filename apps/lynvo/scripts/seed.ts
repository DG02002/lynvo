import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import {
  getLynvoManifestExtension,
  parsePluginServerManifestContract,
  readBoundedResponseText,
} from "@dg02002/lynvo-plugin-server-protocol"
import { Result, Schema } from "effect"

import type { ExtractedLink } from "../app/features/links/types"
import {
  DOCS_SEED_ARTWORK_POLICY,
  DOCS_SEED_PROXY_BALANCE,
  DOCS_SEED_PROXY_KEY,
  DOCS_SEED_MANAGED_USAGE_OPERATION_ID_PREFIX,
} from "../shared/docs-seed-constants"
import {
  LynvoUsageSnapshotSchema,
  PluginServerUsageSchema,
} from "../shared/usage-contracts"
import { assertLocalHttpOrigin } from "./local-origin.mjs"

const DEFAULT_APP_ORIGIN = "http://localhost:5173"
const DEVELOPMENT_USER_ID = "lynvo-development-user"
const DEVELOPMENT_SESSION_ID = "lynvo-development-session"
const DEVELOPMENT_PLUGIN_SERVER_URL = "http://localhost:8788"
const DEFAULT_DEVELOPMENT_PLUGIN_SERVER_KEY = "dev-local-api-key"
const API_RESPONSE_LIMIT_BYTES = 8 * 1024 * 1024
const DAY_MS = 24 * 60 * 60 * 1_000
const HOUR_MS = 60 * 60 * 1_000
const MINUTE_MS = 60 * 1_000

interface DevelopmentPluginServerKeyOptions {
  readonly environment?: Pick<NodeJS.ProcessEnv, "LYNVO_SEED_PLUGIN_SERVER_KEY">
  readonly readLocalEnvironment?: () => Promise<string>
}

export const readDevelopmentPluginServerKey = async ({
  environment = process.env,
  readLocalEnvironment = () =>
    readFile(new URL("../.dev.vars", import.meta.url), "utf8"),
}: DevelopmentPluginServerKeyOptions = {}): Promise<string> => {
  const environmentKey = environment.LYNVO_SEED_PLUGIN_SERVER_KEY?.trim()
  if (environmentKey) {
    return environmentKey
  }

  let localEnvironment: string
  try {
    localEnvironment = await readLocalEnvironment()
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return DEFAULT_DEVELOPMENT_PLUGIN_SERVER_KEY
    }
    throw error
  }

  const keyLine = localEnvironment
    .split(/\r?\n/u)
    .find((line) => line.startsWith("MANAGED_PLUGIN_SERVER_API_KEY="))
  const value = keyLine
    ?.slice("MANAGED_PLUGIN_SERVER_API_KEY=".length)
    .trim()
    .replace(
      /^(?:"(.*)"|'(.*)')$/u,
      (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted ?? ""
    )
  return value || DEFAULT_DEVELOPMENT_PLUGIN_SERVER_KEY
}

type FetchFunction = typeof fetch
type HttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT"
type ApiJsonRequestValue =
  | string
  | number
  | boolean
  | null
  | readonly ApiJsonRequestValue[]
  | { readonly [key: string]: ApiJsonRequestValue | undefined }
type ApiRequestBody = {
  readonly [key: string]: ApiJsonRequestValue | undefined
}

interface ApiMutationOptions {
  body?: ApiRequestBody
  method: Exclude<HttpMethod, "GET">
  path: string
  retryWithOperationId?: boolean
}

interface ApiMutationResponseOptions<ResponseBody> extends ApiMutationOptions {
  body: ApiRequestBody
  responseSchema: Schema.Schema<ResponseBody>
}

interface ApiRequestOptions<ResponseBody> {
  body?: ApiRequestBody
  method: HttpMethod
  path: string
  responseSchema: Schema.Schema<ResponseBody>
  retryWithOperationId?: boolean
}

const readBoundedText = async (
  response: Response
): Promise<string | undefined> => {
  const body = await readBoundedResponseText(response, {
    maximumResponseBytes: API_RESPONSE_LIMIT_BYTES,
  })
  return body || undefined
}

interface CsrfCredential {
  readonly cookie: string
  readonly token: string
}

const readCsrfCredential = async (
  fetchFunction: FetchFunction,
  origin: URL
): Promise<CsrfCredential> => {
  const response = await fetchFunction(new URL("/", origin), {
    headers: { Accept: "text/html" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error(`GET / failed with ${response.status} while signing in.`)
  }
  const html = await readBoundedText(response)
  const token = html?.match(/<meta name="csrf-token" content="([^"]+)"/u)?.[1]
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0]
  if (!token || !cookie?.startsWith("csrf-token=")) {
    throw new Error("The dev server did not return its CSRF session token.")
  }
  return { cookie, token }
}

const createRequestInit = (
  method: HttpMethod,
  headers: Headers,
  serializedBody: string | undefined
): RequestInit => {
  const requestOptions: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  }
  if (serializedBody !== undefined) {
    requestOptions.body = serializedBody
  }
  return requestOptions
}

const createRequestHeaders = (
  origin: URL,
  method: HttpMethod,
  hasBody: boolean
): Headers => {
  const headers = new Headers({ Accept: "application/json" })
  if (hasBody) {
    headers.set("Content-Type", "application/json")
  }
  if (method !== "GET") {
    headers.set("Origin", origin.origin)
  }
  return headers
}

interface FetchRetryOptions {
  readonly fetchFunction: FetchFunction
  readonly headers: Headers
  readonly method: HttpMethod
  readonly retryWithOperationId: boolean | undefined
  readonly serializedBody: string | undefined
  readonly target: URL
}

const fetchWithRetry = async ({
  fetchFunction,
  headers,
  method,
  retryWithOperationId,
  serializedBody,
  target,
}: FetchRetryOptions): Promise<Response> => {
  const attempts = retryWithOperationId ? 2 : 1
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const requestOptions = createRequestInit(method, headers, serializedBody)
      // SAFETY: This loop retries only idempotency-ledger mutations and awaits each response before resending the same operationId.
      // oxlint-disable-next-line eslint/no-await-in-loop
      const response = await fetchFunction(target, requestOptions)
      if (response.ok || response.status < 500 || attempt + 1 >= attempts) {
        return response
      }
      // SAFETY: Cancel a transient response before retrying the same operationId so the unused response does not keep streaming.
      // oxlint-disable-next-line eslint/no-await-in-loop
      await response.body?.cancel()
    } catch (error) {
      if (attempt + 1 >= attempts) {
        throw error
      }
    }
  }

  throw new Error("The Lynvo API request could not be completed.")
}

const ApiErrorResponseSchema = Schema.Struct({
  error: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
  failure: Schema.optional(
    Schema.Struct({ message: Schema.optional(Schema.String) })
  ),
})
const EmptyMutationResponseSchema = Schema.Struct({})
const LinkListResponseSchema = Schema.Struct({
  links: Schema.Array(Schema.Struct({ id: Schema.String, url: Schema.String })),
})
const CreateLinkResponseSchema = Schema.Struct({
  id: Schema.NullOr(Schema.String),
})
const PluginServerListSchema = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    baseUrl: Schema.String,
    manifest: Schema.String,
    enabled: Schema.Boolean,
    verificationStatus: Schema.String,
    hasProxyKey: Schema.Boolean,
    proxyEnabled: Schema.Boolean,
    proxyBalanceRemaining: Schema.NullOr(Schema.Number),
    proxyBalanceLimit: Schema.NullOr(Schema.Number),
  })
)
const PluginDomainListSchema = Schema.Array(
  Schema.Struct({ id: Schema.String })
)
const DeviceCodeResponseSchema = Schema.Struct({
  code: Schema.String,
  pollSecret: Schema.String,
  deviceName: Schema.String,
})
const DeviceExchangeResponseSchema = Schema.Struct({
  userId: Schema.String,
  deviceName: Schema.String,
  sessionId: Schema.String,
})
const SessionListSchema = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    deviceName: Schema.String,
    isCurrent: Schema.Boolean,
  })
)
const SessionStatusSchema = Schema.Struct({
  status: Schema.String,
  userId: Schema.optional(Schema.String),
  sessionId: Schema.optional(Schema.String),
})

type ApiErrorResponse = typeof ApiErrorResponseSchema.Type

const getApiErrorMessage = (response: ApiErrorResponse): string | undefined =>
  response.failure?.message ?? response.error ?? response.message

const getCauseMessage = (cause: unknown): string => {
  if (cause instanceof Error) {
    return cause.message
  }
  try {
    return JSON.stringify(cause) ?? "Unknown error"
  } catch {
    return "Unknown error"
  }
}

interface ParsedResponseBody {
  readonly value: unknown
  readonly error: Error | undefined
}

const parseResponseBody = (
  responseText: string | undefined
): ParsedResponseBody => {
  if (responseText === undefined) {
    return { value: undefined, error: undefined }
  }
  try {
    return { value: JSON.parse(responseText), error: undefined }
  } catch (error) {
    return {
      value: undefined,
      error: error instanceof Error ? error : new Error(getCauseMessage(error)),
    }
  }
}

interface ApiResponseFailureInput {
  readonly response: Response
  readonly options: Pick<ApiRequestOptions<unknown>, "method" | "path">
  readonly parsedBody: ParsedResponseBody
}

const throwApiResponseFailure = ({
  response,
  options,
  parsedBody,
}: ApiResponseFailureInput): never => {
  if (parsedBody.error) {
    const detail = parsedBody.error.message
    throw new Error(
      `${options.method} ${options.path} failed with ${response.status}; the response was not valid JSON: ${detail}`,
      { cause: parsedBody.error }
    )
  }

  const parsedError = Schema.decodeUnknownResult(ApiErrorResponseSchema)(
    parsedBody.value
  )
  const message = Result.isSuccess(parsedError)
    ? getApiErrorMessage(parsedError.success)
    : undefined
  throw new Error(
    `${options.method} ${options.path} failed with ${response.status}${message ? `: ${message}` : "."}`
  )
}

const decodeApiResponse = async <ResponseBody>(
  response: Response,
  options: ApiRequestOptions<ResponseBody>
): Promise<ResponseBody> => {
  const responseText = await readBoundedText(response)
  const parsedBody = parseResponseBody(responseText)
  if (!response.ok) {
    throwApiResponseFailure({ response, options, parsedBody })
  }
  if (parsedBody.error) {
    throw new Error(
      `${options.method} ${options.path} returned invalid JSON: ${parsedBody.error.message}`,
      { cause: parsedBody.error }
    )
  }
  const parsedResponse = Schema.decodeUnknownResult(options.responseSchema)(
    parsedBody.value
  )
  if (Result.isFailure(parsedResponse)) {
    throw new Error(
      `${options.method} ${options.path} returned an unexpected response.`
    )
  }
  return parsedResponse.success
}

export class SeedApiClient {
  readonly origin: URL
  readonly fetchFunction: FetchFunction
  private csrfCredential: CsrfCredential | undefined
  private sessionIdentity:
    | { readonly userId: string; readonly sessionId: string }
    | undefined

  constructor(origin: string, fetchFunction: FetchFunction = fetch) {
    this.origin = new URL(origin)
    this.fetchFunction = fetchFunction
  }

  setSessionIdentity(identity: {
    readonly userId: string
    readonly sessionId: string
  }): void {
    this.sessionIdentity = identity
  }

  async loadCsrfCredential(): Promise<void> {
    this.csrfCredential = await readCsrfCredential(
      this.fetchFunction,
      this.origin
    )
  }

  async get<ResponseBody>(
    path: string,
    responseSchema: Schema.Schema<ResponseBody>
  ): Promise<ResponseBody> {
    return await this.request({ method: "GET", path, responseSchema })
  }

  async mutate(options: ApiMutationOptions): Promise<void> {
    await this.request({
      ...options,
      responseSchema: EmptyMutationResponseSchema,
    })
  }

  async mutateForResponse<ResponseBody>(
    options: ApiMutationResponseOptions<ResponseBody>
  ): Promise<ResponseBody> {
    return await this.request(options)
  }

  private async fetchResponse<ResponseBody>(
    options: ApiRequestOptions<ResponseBody>
  ): Promise<Response> {
    const { body, method, path, retryWithOperationId } = options
    const target = new URL(path, this.origin)
    if (target.origin !== this.origin.origin) {
      throw new Error(
        "The seed CLI only sends requests to the local app origin."
      )
    }
    const headers = createRequestHeaders(
      this.origin,
      method,
      body !== undefined
    )
    if (this.sessionIdentity) {
      headers.set("X-Lynvo-Expected-User-Id", this.sessionIdentity.userId)
      headers.set("X-Lynvo-Expected-Session-Id", this.sessionIdentity.sessionId)
    }
    if (this.csrfCredential) {
      headers.set("Cookie", this.csrfCredential.cookie)
      headers.set("X-CSRF-Token", this.csrfCredential.token)
    }

    const serializedBody = body === undefined ? undefined : JSON.stringify(body)
    return await fetchWithRetry({
      fetchFunction: this.fetchFunction,
      headers,
      method,
      retryWithOperationId,
      serializedBody,
      target,
    })
  }

  private async request<ResponseBody>(
    options: ApiRequestOptions<ResponseBody>
  ): Promise<ResponseBody> {
    const response = await this.fetchResponse(options)
    return await decodeApiResponse(response, options)
  }
}

type LinkNode = ExtractedLink

interface LinkFixture {
  readonly slug: string
  readonly url: string
  readonly title: string
  readonly daysAgo: number
  readonly pluginId: string
  readonly pluginName: string
  readonly nodes: readonly LinkNode[]
  readonly failure?: string
}

interface PlayableNodeInput {
  readonly key: string
  readonly label: string
  readonly url: string
  readonly expiry?: number
  readonly expirySource?: "signed-url"
  readonly size?: string
}

interface LinkSnapshotEntry {
  readonly id: string
  readonly url: string
}

interface LinksResponse {
  readonly links: readonly LinkSnapshotEntry[]
}

interface CreateLinkResponse {
  readonly id: string | null
}

const sourceUrl = (path: string): string =>
  `https://drive.example.invalid/0:/Lynvo%20Demo/${path}`

const playableUrl = (slug: string): string =>
  `https://media.example.invalid/lynvo-demo/${slug}.mkv`

const playableNode = ({
  key,
  label,
  url,
  expiry,
  expirySource,
  size,
}: PlayableNodeInput): LinkNode => ({
  nodeKey: key,
  label,
  type: "file",
  mediaNodeKind: "playable",
  url,
  expiry,
  expirySource,
  size,
})

const groupNode = (
  key: string,
  label: string,
  children: readonly LinkNode[]
): LinkNode => ({
  nodeKey: key,
  label,
  type: "folder",
  mediaNodeKind: "group",
  childrenResolved: true,
  children: [...children],
})

const resolvableNode = (key: string, label: string): LinkNode => ({
  nodeKey: key,
  label,
  type: "folder",
  mediaNodeKind: "resolvable",
  nodeUrl: sourceUrl(`Unresolved/${key}/`),
  resourceId: `docs-${key}`,
  childrenResolved: false,
  resolutionKind: "folder",
})

const createDocsLinkFixtures = (seedTime: number): readonly LinkFixture[] => [
  {
    slug: "drive-library",
    url: sourceUrl("Shows%20and%20Movies/"),
    title: "Shows and movies",
    daysAgo: 12,
    pluginId: "bhadoo-google-drive-index",
    pluginName: "Bhadoo’s Google Drive Index",
    nodes: [
      groupNode("library-shows", "TV Shows", [
        groupNode("library-severance", "Severance", [
          groupNode("library-severance-s02", "Season 02", [
            playableNode({
              key: "library-severance-s02e03",
              label: "Severance S02E03.mkv",
              url: playableUrl("severance-s02e03"),
              size: "1.4 GB",
            }),
          ]),
          resolvableNode("severance-season-03", "Season 03"),
        ]),
        groupNode("library-bear", "The Bear", [
          playableNode({
            key: "library-bear-s02e04",
            label: "Season 02/The Bear S02E04.mkv",
            url: playableUrl("the-bear-s02e04"),
            size: "1.1 GB",
          }),
        ]),
      ]),
      groupNode("library-movies", "Movies", [
        playableNode({
          key: "library-dune-part-two",
          label: "Dune Part Two (2024).mkv",
          url: playableUrl("dune-part-two"),
          size: "2.8 GB",
        }),
      ]),
    ],
  },
  {
    slug: "the-bear-season-01",
    url: sourceUrl("The%20Bear/Season%2001/"),
    title: "The Bear",
    daysAgo: 2,
    pluginId: "bhadoo-google-drive-index",
    pluginName: "Bhadoo’s Google Drive Index",
    nodes: [
      groupNode("bear-s01-show", "The Bear", [
        groupNode("bear-s01-folder", "Season 01", [
          playableNode({
            key: "bear-s01e01",
            label: "The Bear S01E01.mkv",
            url: playableUrl("the-bear-s01e01"),
            size: "1.0 GB",
          }),
          playableNode({
            key: "bear-s01e02",
            label: "The Bear S01E02.mkv",
            url: playableUrl("the-bear-s01e02"),
            size: "980 MB",
          }),
        ]),
      ]),
    ],
  },
  {
    slug: "the-bear-season-02",
    url: sourceUrl("The%20Bear/Season%2002/"),
    title: "The Bear",
    daysAgo: 4,
    pluginId: "onedrive-index",
    pluginName: "Spencerwooo’s OneDrive Vercel Index",
    nodes: [
      groupNode("bear-s02-show", "The Bear", [
        groupNode("bear-s02-folder", "Season 02", [
          playableNode({
            key: "bear-s02e04",
            label: "The Bear S02E04.mkv",
            url: playableUrl("the-bear-s02e04"),
            size: "1.1 GB",
          }),
          playableNode({
            key: "bear-s02e05",
            label: "The Bear S02E05.mkv",
            url: playableUrl("the-bear-s02e05"),
            size: "1.2 GB",
          }),
        ]),
      ]),
    ],
  },
  {
    slug: "severance-s02e03",
    url: sourceUrl("Severance/Season%2002/Severance%20S02E03.mkv"),
    title: "Severance",
    daysAgo: 0,
    pluginId: "direct-media",
    pluginName: "Direct Media",
    nodes: [
      playableNode({
        key: "severance-s02e03-direct",
        label: "Severance S02E03.mkv",
        url: playableUrl("severance-s02e03"),
        expiry: seedTime + 3 * DAY_MS + 4 * HOUR_MS + 59 * MINUTE_MS,
        expirySource: "signed-url",
        size: "1.4 GB",
      }),
    ],
  },
  {
    slug: "dune-part-two",
    url: sourceUrl("Movies/Dune%20Part%20Two%20(2024).mkv"),
    title: "Dune: Part Two",
    daysAgo: 0,
    pluginId: "direct-media",
    pluginName: "Direct Media",
    nodes: [
      playableNode({
        key: "dune-part-two-opened",
        label: "Dune Part Two (2024).mkv",
        url: playableUrl("dune-part-two"),
        size: "2.8 GB",
      }),
    ],
  },
  {
    slug: "arrival-expired",
    url: sourceUrl("Movies/Arrival%20(2016).mkv"),
    title: "Arrival",
    daysAgo: 10,
    pluginId: "direct-media",
    pluginName: "Direct Media",
    nodes: [
      playableNode({
        key: "arrival-expired",
        label: "Arrival (2016).mkv",
        url: playableUrl("arrival"),
        expiry: seedTime - MINUTE_MS,
        expirySource: "signed-url",
        size: "1.6 GB",
      }),
    ],
  },
  {
    slug: "failed-extraction",
    url: sourceUrl("Failed%20extraction/"),
    title: "Season archive",
    daysAgo: 1,
    pluginId: "bhadoo-google-drive-index",
    pluginName: "Bhadoo’s Google Drive Index",
    nodes: [],
    failure: "The Plugin could not resolve this Source URL.",
  },
]

const linkMetadata = (
  fixture: LinkFixture,
  pluginServerId: string,
  seedTime: number
) => {
  const metadata = {
    schemaVersion: 3,
    artworkPolicy: DOCS_SEED_ARTWORK_POLICY,
    source: {
      pluginId: fixture.pluginId,
      pluginName: fixture.pluginName,
      pluginServerId,
      sourceName: fixture.pluginName,
    },
    extraction: { extractedLinks: fixture.nodes, extractedAt: seedTime },
    playback: { openedUrls: [], resolvedMirrors: {} },
  }
  if (fixture.failure === undefined) {
    return JSON.stringify(metadata)
  }
  return JSON.stringify({
    ...metadata,
    debugLog: [
      {
        at: seedTime,
        pluginServerId,
        pluginId: fixture.pluginId,
        outcome: "failed",
        errorCode: "UNSUPPORTED_URL",
        detail: "This local fixture made no upstream request.",
        httpStatus: 422,
        durationMs: 0,
        attempt: 1,
      },
    ],
  })
}

const createOperationId = (): string => randomUUID()

export const seedDocsLinks = async (
  api: SeedApiClient,
  input: { readonly seedTime: number; readonly pluginServerId: string }
): Promise<readonly LinkSnapshotEntry[]> => {
  const fixtures = createDocsLinkFixtures(input.seedTime)
  const expectedUrls = new Set(fixtures.map((fixture) => fixture.url))
  const current = await api.get<LinksResponse>(
    "/api/data/links",
    LinkListResponseSchema
  )
  for (const link of current.links) {
    if (expectedUrls.has(link.url)) {
      continue
    }
    // SAFETY: Each deletion must complete before the next write so its operationId and data-version response are settled in order.
    // oxlint-disable-next-line eslint/no-await-in-loop
    await api.mutate({
      method: "POST",
      path: "/api/data/links/delete",
      body: { operationId: createOperationId(), id: link.id },
      retryWithOperationId: true,
    })
  }

  const idsBySlug = new Map<string, string>()
  for (const fixture of fixtures) {
    // SAFETY: Saved link upserts run sequentially so each operationId write finishes before the next account mutation.
    // oxlint-disable-next-line eslint/no-await-in-loop
    const result = await api.mutateForResponse<CreateLinkResponse>({
      method: "POST",
      path: "/api/data/links/create-or-update",
      body: {
        operationId: createOperationId(),
        url: fixture.url,
        title: fixture.title,
        meta: linkMetadata(fixture, input.pluginServerId, input.seedTime),
        seedFixture: {
          createdAt: input.seedTime - fixture.daysAgo * DAY_MS,
          extractionFailure: fixture.failure,
        },
      },
      responseSchema: CreateLinkResponseSchema,
      retryWithOperationId: true,
    })
    if (!result.id) {
      throw new Error(`The ${fixture.slug} Saved link did not return an ID.`)
    }
    idsBySlug.set(fixture.slug, result.id)
  }

  const openedSavedLinkId = idsBySlug.get("dune-part-two")
  if (!openedSavedLinkId) {
    throw new Error("The Dune: Part Two Saved link is missing.")
  }
  await api.mutate({
    method: "POST",
    path: "/api/data/links/apply-metadata-operation",
    body: {
      operationId: createOperationId(),
      id: openedSavedLinkId,
      operation: {
        kind: "markOpened",
        linkUrl: playableUrl("dune-part-two"),
      },
    },
    retryWithOperationId: true,
  })

  const updated = await api.get<LinksResponse>(
    "/api/data/links",
    LinkListResponseSchema
  )
  return updated.links
}

type PluginServerEntry = (typeof PluginServerListSchema.Type)[number]

type PluginServerUsageEntry = typeof PluginServerUsageSchema.Type

interface PluginDomainEntry {
  readonly id: string
}

interface DeviceCodeResponse {
  readonly code: string
  readonly pollSecret: string
  readonly deviceName: string
}

interface DeviceExchangeResponse {
  readonly userId: string
  readonly deviceName: string
  readonly sessionId: string
}

interface SessionEntry {
  readonly id: string
  readonly deviceName: string
  readonly isCurrent: boolean
}

const normalizedServerUrl = (value: string): string => {
  const url = new URL(value)
  return `${url.origin}${url.pathname.replace(/\/$/, "")}`
}

const clearPluginDomains = async (api: SeedApiClient): Promise<void> => {
  const domains = await api.get<readonly PluginDomainEntry[]>(
    "/api/plugin-domains",
    PluginDomainListSchema
  )
  for (const domain of domains) {
    // SAFETY: Delete Plugin Domains in sequence so every public API mutation completes before the next.
    // oxlint-disable-next-line eslint/no-await-in-loop
    await api.mutate({
      method: "DELETE",
      path: `/api/plugin-domains/${encodeURIComponent(domain.id)}`,
    })
  }
}

const deleteOtherPluginServers = async (
  api: SeedApiClient,
  servers: readonly PluginServerEntry[],
  keepServerId: string | undefined
): Promise<void> => {
  for (const server of servers) {
    if (server.id === keepServerId) {
      continue
    }
    // SAFETY: Remove other Plugin Servers in sequence to preserve their public API data-version mutations.
    // oxlint-disable-next-line eslint/no-await-in-loop
    await api.mutate({
      method: "DELETE",
      path: `/api/plugin-servers/${encodeURIComponent(server.id)}`,
    })
  }
}

const registerOrRefreshLocalPluginServer = async (
  api: SeedApiClient,
  existingServer: PluginServerEntry | undefined
): Promise<void> => {
  if (!existingServer) {
    const apiKey = await readDevelopmentPluginServerKey()
    await api.mutate({
      method: "POST",
      path: "/api/plugin-servers",
      body: {
        baseUrl: DEVELOPMENT_PLUGIN_SERVER_URL,
        apiKey,
      },
    })
    return
  }
  if (!existingServer.enabled) {
    await api.mutate({
      method: "POST",
      path: `/api/plugin-servers/${encodeURIComponent(existingServer.id)}/toggle`,
      body: { enabled: true },
    })
  }
  await api.mutate({
    method: "POST",
    path: `/api/plugin-servers/${encodeURIComponent(existingServer.id)}/refresh`,
  })
}

const requireLocalPluginServer = async (
  api: SeedApiClient
): Promise<PluginServerEntry> => {
  const servers = await api.get<readonly PluginServerEntry[]>(
    "/api/plugin-servers",
    PluginServerListSchema
  )
  const targetUrl = normalizedServerUrl(DEVELOPMENT_PLUGIN_SERVER_URL)
  const target = servers.find(
    (server) => normalizedServerUrl(server.baseUrl) === targetUrl
  )
  await deleteOtherPluginServers(api, servers, target?.id)
  await registerOrRefreshLocalPluginServer(api, target)

  const refreshedServers = await api.get<readonly PluginServerEntry[]>(
    "/api/plugin-servers",
    PluginServerListSchema
  )
  const pluginServer = refreshedServers.find(
    (server) => normalizedServerUrl(server.baseUrl) === targetUrl
  )
  if (!pluginServer) {
    throw new Error("The local Custom Plugin Server was not registered.")
  }
  if (pluginServer.verificationStatus !== "verified") {
    throw new Error("The local Custom Plugin Server could not be verified.")
  }
  return pluginServer
}

const createDocsPluginDomains = async (
  api: SeedApiClient,
  pluginServerId: string
): Promise<void> => {
  await api.mutate({
    method: "POST",
    path: "/api/plugin-domains",
    body: {
      domain: "drive.example.invalid",
      pluginServerId,
      pluginId: "bhadoo-google-drive-index",
      username: "docs-reader",
      password: "demo-library-password",
    },
  })
  await api.mutate({
    method: "POST",
    path: "/api/plugin-domains",
    body: {
      domain: "onedrive.example.invalid",
      pluginServerId,
      pluginId: "onedrive-index",
      password: "demo-index-password",
    },
  })
}

const configureAndVerifyProxy = async (
  api: SeedApiClient,
  pluginServerId: string
): Promise<void> => {
  await api.mutate({
    method: "POST",
    path: `/api/plugin-servers/${encodeURIComponent(pluginServerId)}/proxy/key`,
    body: { token: DOCS_SEED_PROXY_KEY },
  })
  await api.mutate({
    method: "POST",
    path: `/api/plugin-servers/${encodeURIComponent(pluginServerId)}/proxy/toggle`,
    body: { enabled: true },
  })
  const configuredServers = await api.get<readonly PluginServerEntry[]>(
    "/api/plugin-servers",
    PluginServerListSchema
  )
  const configuredServer = configuredServers.find(
    (server) => server.id === pluginServerId
  )
  if (
    !configuredServer?.hasProxyKey ||
    !configuredServer.proxyEnabled ||
    configuredServer.proxyBalanceRemaining !==
      DOCS_SEED_PROXY_BALANCE.remaining ||
    configuredServer.proxyBalanceLimit !== DOCS_SEED_PROXY_BALANCE.limit
  ) {
    throw new Error("The docs scenario could not configure its proxy balance.")
  }

  let manifestJson: unknown
  try {
    manifestJson = JSON.parse(configuredServer.manifest)
  } catch (cause) {
    const detail = getCauseMessage(cause)
    throw new Error(
      `The local Custom Plugin Server manifest is invalid JSON: ${detail}`,
      { cause }
    )
  }
  const manifest = parsePluginServerManifestContract(manifestJson)
  if (!manifest.ok || !manifest.value) {
    const detail = manifest.issues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("; ")
    throw new Error(
      `The local Custom Plugin Server manifest is invalid: ${detail}`
    )
  }
  const proxyUsagePlugins = getLynvoManifestExtension(
    manifest.value
  ).plugins?.filter((plugin) => plugin.proxyCreditUsage)
  if (
    !proxyUsagePlugins?.some(
      (plugin) => plugin.id === "bhadoo-google-drive-index"
    ) ||
    !proxyUsagePlugins.some((plugin) => plugin.id === "onedrive-index")
  ) {
    throw new Error(
      "The local Custom Plugin Server has no per-Plugin proxy usage."
    )
  }
}

const verifyPluginUsageRows = async (
  api: SeedApiClient,
  pluginServerId: string
): Promise<void> => {
  const pluginUsage = await api.get<readonly PluginServerUsageEntry[]>(
    "/api/plugin-servers/usage",
    Schema.Array(PluginServerUsageSchema)
  )
  if (
    !pluginUsage.some(
      (entry) =>
        entry.pluginServerId === pluginServerId &&
        entry.error === undefined &&
        entry.metrics.some(
          (metric) => metric.id === "lynvo-plugin-server-operations"
        )
    )
  ) {
    throw new Error("The local Custom Plugin Server returned no usage rows.")
  }

  const managedUsage = await api.get<typeof LynvoUsageSnapshotSchema.Type>(
    "/api/data/usage",
    LynvoUsageSnapshotSchema
  )
  if (
    !managedUsage.metrics.some(
      (metric) =>
        metric.id === "lynvo-plugin-server-operations" && metric.used === 1
    ) ||
    !managedUsage.metrics.some(
      (metric) =>
        metric.id === "lynvo-plugin-server-extractions" && metric.used === 1
    )
  ) {
    throw new Error("The managed Plugin Server returned no usage rows.")
  }
}

const seedDocsManagedUsage = async (
  api: SeedApiClient,
  seedTime: number
): Promise<void> => {
  const operationId = `${DOCS_SEED_MANAGED_USAGE_OPERATION_ID_PREFIX}${new Date(seedTime).toISOString().slice(0, 10)}`
  await api.mutate({
    method: "POST",
    path: "/api/data/usage/docs-seed",
    body: { operationId },
    retryWithOperationId: true,
  })
}

const seedDocsSettings = async (
  api: SeedApiClient,
  seedTime: number
): Promise<string> => {
  await clearPluginDomains(api)
  const pluginServer = await requireLocalPluginServer(api)
  await createDocsPluginDomains(api, pluginServer.id)
  await configureAndVerifyProxy(api, pluginServer.id)
  await seedDocsManagedUsage(api, seedTime)
  await verifyPluginUsageRows(api, pluginServer.id)
  return pluginServer.id
}

const createActiveDeviceSession = async (
  api: SeedApiClient,
  deviceName: string
): Promise<void> => {
  const code = await api.mutateForResponse<DeviceCodeResponse>({
    method: "POST",
    path: "/api/auth/device/code",
    body: { deviceName },
    responseSchema: DeviceCodeResponseSchema,
  })
  await api.mutate({
    method: "POST",
    path: "/api/auth/device/authorize",
    body: { code: code.code },
  })

  const attemptId = createOperationId()
  const exchangePath = new URLSearchParams({
    code: code.code,
    pollSecret: code.pollSecret,
    attemptId,
    generation: "1",
  })
  const claim = await api.get<DeviceExchangeResponse>(
    `/api/auth/device/exchange?${exchangePath.toString()}`,
    DeviceExchangeResponseSchema
  )
  if (claim.userId !== DEVELOPMENT_USER_ID || claim.deviceName !== deviceName) {
    throw new Error("Device sign-in did not return the development account.")
  }
  await api.mutate({
    method: "POST",
    path: "/api/auth/device/exchange/finalize",
    body: {
      code: code.code,
      pollSecret: code.pollSecret,
      attemptId,
      generation: 1,
      sessionId: claim.sessionId,
    },
  })
}

export const seedDocsSessions = async (api: SeedApiClient): Promise<number> => {
  const expectedDeviceNames = ["Android TV", "Phone browser"]
  const existingSessions = await api.get<readonly SessionEntry[]>(
    "/api/settings/security/sessions",
    SessionListSchema
  )

  // Reusing named sessions keeps repeated local seeds within device-approval limits.
  for (const deviceName of expectedDeviceNames) {
    if (
      !existingSessions.some((session) => session.deviceName === deviceName)
    ) {
      // SAFETY: Create only missing fixtures; each request completes before the next approval.
      // oxlint-disable-next-line eslint/no-await-in-loop
      await createActiveDeviceSession(api, deviceName)
    }
  }

  const sessions = await api.get<readonly SessionEntry[]>(
    "/api/settings/security/sessions",
    SessionListSchema
  )
  if (sessions.length < 3 || !sessions.some((session) => session.isCurrent)) {
    throw new Error("The docs scenario did not create three active sessions.")
  }
  return sessions.length
}

const requireNoAuthDevelopmentAccount = async (
  api: SeedApiClient
): Promise<void> => {
  const status = await api.get<{
    readonly status: string
    readonly userId?: string
    readonly sessionId?: string
  }>(
    `/api/auth/session/status?expectedUserId=${encodeURIComponent(DEVELOPMENT_USER_ID)}&expectedSessionId=${encodeURIComponent(DEVELOPMENT_SESSION_ID)}`,
    SessionStatusSchema
  )
  if (
    status.status !== "authenticated" ||
    status.userId !== DEVELOPMENT_USER_ID ||
    status.sessionId !== DEVELOPMENT_SESSION_ID
  ) {
    throw new Error(
      "Start the app with `pnpm dev --no-auth` before running the seed CLI."
    )
  }
  api.setSessionIdentity({
    userId: status.userId,
    sessionId: status.sessionId,
  })
  await api.loadCsrfCredential()
}

export const seedDocsScenario = async (
  api: SeedApiClient,
  seedTime = Date.now()
): Promise<{ readonly links: number; readonly sessions: number }> => {
  await requireNoAuthDevelopmentAccount(api)
  const pluginServerId = await seedDocsSettings(api, seedTime)
  const links = await seedDocsLinks(api, { seedTime, pluginServerId })
  const sessions = await seedDocsSessions(api)
  return { links: links.length, sessions }
}

type SeedScenario = (
  api: SeedApiClient
) => Promise<{ readonly links: number; readonly sessions: number }>

const seedScenarios = {
  docs: seedDocsScenario,
} satisfies Readonly<Record<string, SeedScenario>>

const isSeedScenarioName = (
  scenarioName: string
): scenarioName is keyof typeof seedScenarios =>
  Object.hasOwn(seedScenarios, scenarioName)

const formatSeedError = (error: Error): string => {
  const errorStack = error.stack ?? error.message
  if (error.cause === undefined) {
    return errorStack
  }
  const formattedCause =
    error.cause instanceof Error
      ? formatSeedError(error.cause)
      : getCauseMessage(error.cause)
  return `${errorStack}\nCaused by: ${formattedCause}`
}

const run = async (): Promise<void> => {
  const [scenarioName, ...unexpectedArguments] = process.argv.slice(2)
  const registeredScenarioName =
    scenarioName && isSeedScenarioName(scenarioName) ? scenarioName : undefined
  const seedScenario = registeredScenarioName
    ? seedScenarios[registeredScenarioName]
    : undefined
  if (!seedScenario || unexpectedArguments.length > 0) {
    const scenarios = Object.keys(seedScenarios).join("|")
    throw new Error(`Usage: pnpm --filter @lynvo/app seed <${scenarios}>`)
  }

  const origin = assertLocalHttpOrigin(
    process.env.LYNVO_SEED_ORIGIN ?? DEFAULT_APP_ORIGIN,
    "The seed CLI only writes to a local HTTP dev server. Set LYNVO_SEED_ORIGIN to a localhost origin."
  )
  const api = new SeedApiClient(origin.href)
  const summary = await seedScenario(api)
  process.stdout.write(
    `Seeded the docs scenario: ${summary.links} Saved links and ${summary.sessions} active sessions at ${origin.origin}.\n`
  )
}

const [invokedFile] = process.argv.slice(1)
if (invokedFile && fileURLToPath(import.meta.url) === invokedFile) {
  run().catch((cause: unknown) => {
    const error =
      cause instanceof Error ? cause : new Error(getCauseMessage(cause))
    process.stderr.write(`${formatSeedError(error)}\n`)
    process.exitCode = 1
  })
}

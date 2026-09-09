import type {
  JsonValue,
  RangeRequestCapability,
} from "@dg02002/lynvo-plugin-server-protocol"
import { Result, Schema } from "effect"
import { getCsrfToken } from "../utils"
import { sessionIdentityHeaders } from "../session-identity"

export interface ApiRequestOptions {
  readonly signal?: AbortSignal
}

interface ApiQuery {
  readonly kind?: string
  readonly pluginId?: string
  readonly pluginServerId?: string
  readonly receiverId?: string
  readonly url?: string
}

type RequestOptions<Payload = undefined> = ApiRequestOptions & {
  readonly method?: "DELETE" | "GET" | "PATCH" | "POST"
  readonly headers?: Record<string, string>
  readonly payload?: Payload
  readonly query?: ApiQuery
}

const apiErrorBodySchema = Schema.Struct({
  _tag: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
  retryAfterSeconds: Schema.optional(Schema.Number),
})

type ApiErrorBody = typeof apiErrorBodySchema.Type

const decodeApiErrorBody = (value: JsonValue | undefined) => {
  if (value === undefined) {
    return undefined
  }
  const decoded = Schema.decodeUnknownResult(apiErrorBodySchema)(value)
  return Result.isSuccess(decoded) ? decoded.success : undefined
}

const readErrorMessage = (
  body: ApiErrorBody | undefined,
  status: number
): string => body?.message ?? `Request failed with status ${status}`

/**
 * The generated HttpApiClient exposed tagged server errors directly. Keep
 * that shape for callers while avoiding the client-side HTTP API runtime.
 */
export class ApiClientError extends Error {
  _tag: string
  readonly status: number
  readonly headers: Headers
  readonly body: ApiErrorBody | undefined

  constructor({
    body,
    response,
  }: {
    readonly body: ApiErrorBody | undefined
    readonly response: Response
  }) {
    super(readErrorMessage(body, response.status))
    this.name = "ApiClientError"
    this.status = response.status
    this.headers = response.headers
    this.body = body

    if (body) {
      Object.assign(this, body)
    }

    this._tag = body?._tag ?? "ApiClientError"
  }
}

const appendQuery = (path: string, query: ApiQuery | undefined): string => {
  if (!query) {
    return path
  }
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, value)
    }
  }
  const serialized = params.toString()
  return serialized ? `${path}?${serialized}` : path
}

const resolveRequestUrl = (path: string): string =>
  globalThis.location === undefined
    ? path
    : new URL(path, globalThis.location.href).toString()

const readJson = async (response: Response): Promise<JsonValue | undefined> => {
  const value = await response.json().catch(() => undefined)
  // SAFETY: the same-origin API contract returns JSON values in every response body.
  return value as JsonValue | undefined
}

const requestJson = async <ResponseBody, Payload = undefined>(
  path: string,
  {
    method = "GET",
    headers,
    payload,
    query,
    signal,
  }: RequestOptions<Payload> = {}
): Promise<ResponseBody> => {
  const requestHeaders = new Headers({
    Accept: "application/json",
    ...sessionIdentityHeaders(),
    ...headers,
  })

  if (payload !== undefined) {
    requestHeaders.set("Content-Type", "application/json")
  }

  if (method !== "GET") {
    requestHeaders.set("X-CSRF-Token", getCsrfToken() || "")
  }

  const response = await fetch(resolveRequestUrl(appendQuery(path, query)), {
    method,
    credentials: "include",
    headers: requestHeaders,
    body: payload === undefined ? undefined : JSON.stringify(payload),
    signal,
  })
  const body = await readJson(response)
  if (!response.ok) {
    throw new ApiClientError({ body: decodeApiErrorBody(body), response })
  }
  // SAFETY: each client method supplies the response type for its same-origin endpoint.
  return body as ResponseBody
}

type MutationResult = { readonly success: boolean }

interface PluginServer {
  readonly id: string
  readonly userId: string
  readonly baseUrl: string
  readonly manifest: string
  readonly enabled: boolean
  readonly priority: number
  readonly verificationStatus: string
  readonly hasProxyKey: boolean
  readonly proxyBalanceRemaining?: number | null
  readonly proxyBalanceLimit?: number | null
  readonly lastVerifiedAt?: number | null
  readonly lastManifestRefreshAt?: number | null
  readonly createdAt: number
  readonly updatedAt: number
}

interface PluginDomain {
  readonly id: string
  readonly userId: string
  readonly pluginServerId: string
  readonly domain: string
  readonly pluginId: string
  readonly hasCredential: boolean
}

interface PluginServerUsage {
  readonly pluginServerId: string
  readonly name: string
  readonly iconUrl?: string
  readonly plugins?: readonly {
    readonly id: string
    readonly name: string
    readonly iconUrl?: string
  }[]
  readonly metrics: readonly UsageMetric[]
  readonly error?: string
}

interface PlayerPreferences {
  readonly rangeSupportedPlayerId?: "just" | "vlc" | "mpv" | "mx"
  readonly rangeUnsupportedPlayerId?: "just" | "vlc" | "mpv" | "mx"
}

interface UserSession {
  readonly id: string
  readonly deviceName: string
  readonly lastActiveAt: number
  readonly createdAt: number
  readonly isCurrent: boolean
}

interface RemotePollResponse {
  readonly commands: readonly {
    readonly id: string
    readonly claimToken: string
    readonly command: "play"
    readonly payload: string
    readonly createdAt: number
  }[]
}

interface ExtractionQuery {
  readonly url: string
  readonly pluginServerId?: string
  readonly pluginId?: string
  readonly kind?: string
}

interface ExtractionRequest {
  readonly query: ExtractionQuery
  readonly headers?: Record<string, string>
}

interface CreatePluginServerPayload {
  readonly apiKey: string
  readonly baseUrl: string
}

interface CreatePluginDomainPayload {
  readonly domain: string
  readonly password?: string
  readonly pluginId: string
  readonly pluginServerId: string
  readonly username?: string
}

interface SetCredentialPayload {
  readonly password: string
  readonly username?: string
}

interface RemoteSendPayload {
  readonly command: "play"
  readonly data?: {
    readonly rangeRequest: RangeRequestCapability
    readonly url: string
  }
  readonly target_session_id: string
}

interface RemoteResultPayload {
  readonly claimToken: string
  readonly id: string
  readonly message?: string
  readonly receiverId: string
  readonly result: "applied" | "failed"
}

interface ActivityPayload {
  readonly deviceName: string
}

interface DeleteAccountPayload {
  readonly confirmEmail: string
}

const mutation = <ResponseBody, Payload = undefined>(
  path: string,
  method: "DELETE" | "PATCH" | "POST",
  payload?: Payload
) => requestJson<ResponseBody, Payload>(path, { method, payload })

export const client = {
  extraction: {
    extract: (
      input: ExtractionRequest,
      options?: ApiRequestOptions
    ): Promise<JsonValue> =>
      requestJson<JsonValue>("/api/extract", {
        query: input.query,
        headers: input.headers,
        signal: options?.signal,
      }),
    getMetadata: (
      input: ExtractionRequest,
      options?: ApiRequestOptions
    ): Promise<JsonValue> =>
      requestJson<JsonValue>("/api/meta", {
        query: input.query,
        headers: input.headers,
        signal: options?.signal,
      }),
  },
  pluginServers: {
    list: (): Promise<readonly PluginServer[]> =>
      requestJson<readonly PluginServer[]>("/api/plugin-servers"),
    usage: (): Promise<readonly PluginServerUsage[]> =>
      requestJson<readonly PluginServerUsage[]>("/api/plugin-servers/usage"),
    create: (input: {
      readonly payload: CreatePluginServerPayload
    }): Promise<MutationResult> =>
      mutation<MutationResult, CreatePluginServerPayload>(
        "/api/plugin-servers",
        "POST",
        input.payload
      ),
    toggle: (input: {
      readonly params: { readonly pluginServerId: string }
      readonly payload: { readonly enabled: boolean }
    }): Promise<MutationResult> =>
      mutation<MutationResult, { readonly enabled: boolean }>(
        `/api/plugin-servers/${encodeURIComponent(input.params.pluginServerId)}/toggle`,
        "POST",
        input.payload
      ),
    refresh: (input: {
      readonly params: { readonly pluginServerId: string }
    }): Promise<MutationResult> =>
      mutation<MutationResult>(
        `/api/plugin-servers/${encodeURIComponent(input.params.pluginServerId)}/refresh`,
        "POST"
      ),
    setProxyKey: (input: {
      readonly params: { readonly pluginServerId: string }
      readonly payload: { readonly token: string }
    }): Promise<
      MutationResult & {
        readonly remaining: number | null
        readonly limit: number | null
      }
    > =>
      mutation<
        MutationResult & {
          readonly remaining: number | null
          readonly limit: number | null
        },
        { readonly token: string }
      >(
        `/api/plugin-servers/${encodeURIComponent(input.params.pluginServerId)}/proxy-key`,
        "POST",
        input.payload
      ),
    delete: (input: {
      readonly params: { readonly pluginServerId: string }
    }): Promise<MutationResult> =>
      mutation<MutationResult>(
        `/api/plugin-servers/${encodeURIComponent(input.params.pluginServerId)}`,
        "DELETE"
      ),
  },
  pluginDomains: {
    list: (): Promise<readonly PluginDomain[]> =>
      requestJson<readonly PluginDomain[]>("/api/plugin-domains"),
    create: (input: {
      readonly payload: CreatePluginDomainPayload
    }): Promise<MutationResult> =>
      mutation<MutationResult, CreatePluginDomainPayload>(
        "/api/plugin-domains",
        "POST",
        input.payload
      ),
    setCredential: (input: {
      readonly params: { readonly domainId: string }
      readonly payload: {
        readonly password: string
        readonly username?: string
      }
    }): Promise<MutationResult> =>
      mutation<MutationResult, SetCredentialPayload>(
        `/api/plugin-domains/${encodeURIComponent(input.params.domainId)}/credential`,
        "PATCH",
        input.payload
      ),
    deleteCredential: (input: {
      readonly params: { readonly domainId: string }
    }): Promise<MutationResult> =>
      mutation<MutationResult>(
        `/api/plugin-domains/${encodeURIComponent(input.params.domainId)}/credential`,
        "DELETE"
      ),
    delete: (input: {
      readonly params: { readonly domainId: string }
    }): Promise<MutationResult> =>
      mutation<MutationResult>(
        `/api/plugin-domains/${encodeURIComponent(input.params.domainId)}`,
        "DELETE"
      ),
  },
  remote: {
    send: (input: {
      readonly payload: RemoteSendPayload
    }): Promise<MutationResult> =>
      mutation<MutationResult, RemoteSendPayload>(
        "/api/remote/send",
        "POST",
        input.payload
      ),
    pollInbox: (input: {
      readonly query: { readonly receiverId: string }
    }): Promise<RemotePollResponse> =>
      requestJson<RemotePollResponse>("/api/remote/inbox", {
        query: input.query,
      }),
    reportResult: (input: {
      readonly payload: RemoteResultPayload
    }): Promise<MutationResult> =>
      mutation<MutationResult, RemoteResultPayload>(
        "/api/remote/result",
        "POST",
        input.payload
      ),
  },
  settings: {
    touchActivity: (input: {
      readonly payload: ActivityPayload
    }): Promise<MutationResult> =>
      mutation<MutationResult, ActivityPayload>(
        "/api/settings/activity",
        "POST",
        input.payload
      ),
    getPlayerPreferences: (): Promise<PlayerPreferences> =>
      requestJson<PlayerPreferences>("/api/settings/player"),
    updatePlayerPreferences: (input: {
      readonly payload: PlayerPreferences
    }): Promise<MutationResult> =>
      mutation<MutationResult, PlayerPreferences>(
        "/api/settings/player",
        "PATCH",
        input.payload
      ),
    listSessions: (): Promise<readonly UserSession[]> =>
      requestJson<readonly UserSession[]>("/api/settings/security/sessions"),
    revokeSession: (input: {
      readonly params: { readonly sessionId: string }
    }): Promise<MutationResult> =>
      mutation<MutationResult>(
        `/api/settings/security/sessions/${encodeURIComponent(input.params.sessionId)}`,
        "DELETE"
      ),
    revokeAllSessions: (): Promise<MutationResult> =>
      mutation<MutationResult>("/api/settings/security/sessions", "DELETE"),
    deleteAccount: (input: {
      readonly payload: DeleteAccountPayload
    }): Promise<MutationResult> =>
      mutation<MutationResult, DeleteAccountPayload>(
        "/api/settings/security/account",
        "DELETE",
        input.payload
      ),
  },
}

import { Result, Schema } from "effect"
import { getCsrfToken } from "../utils"
import { sessionIdentityHeaders } from "../session-identity"
import {
  MutationResultSchema,
  PluginDomainListSchema,
  PluginServerListSchema,
  PluginServerUsageListSchema,
  PlayerPreferencesSchema,
  RefreshProxyBalanceResponseSchema,
  RemotePollResponseSchema,
  SetProxyKeyResponseSchema,
  UserSessionListSchema,
  VersionedMutationResultSchema,
  type ActivityPayload,
  type CreatePluginDomainPayload,
  type CreatePluginServerPayload,
  type DeleteAccountPayload,
  type ExtractQuery,
  type MetadataQuery,
  type MutationResult,
  type PlayerPreferences,
  type PluginDomainList,
  type PluginServerList,
  type PluginServerUsageList,
  type RefreshProxyBalanceResponse,
  type RemotePollResponse,
  type RemotePollQuery,
  type RemoteResultPayload,
  type RemoteSendPayload,
  type SetCredentialPayload,
  type SetProxyKeyPayload,
  type SetProxyKeyResponse,
  type TogglePluginServerPayload,
  type UserSessionList,
  type VersionedMutationResult,
} from "../api-contracts"

interface ApiRequestOptions {
  readonly signal?: AbortSignal
}

type RequestQuery = ExtractQuery | MetadataQuery | RemotePollQuery

type RequestOptions<Payload = undefined> = ApiRequestOptions & {
  readonly method?: "DELETE" | "GET" | "PATCH" | "POST"
  readonly headers?: Record<string, string>
  readonly payload?: Payload
  readonly query?: RequestQuery
}

type RequestParams<Name extends string> = {
  readonly params: { readonly [Key in Name]: string }
}

type PluginServerParams = RequestParams<"pluginServerId">
type PluginDomainParams = RequestParams<"domainId">
type SessionParams = RequestParams<"sessionId">

const apiErrorBodySchema = Schema.Struct({
  _tag: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
  retryAfterSeconds: Schema.optional(Schema.Number),
})

type ApiErrorBody = typeof apiErrorBodySchema.Type

type JsonResponse = typeof Schema.Json.Type

const decodeApiErrorBody = (value: JsonResponse | undefined) => {
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
  readonly retryAfterSeconds: number | undefined

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
    this._tag = body?._tag ?? "ApiClientError"
    this.retryAfterSeconds = body?.retryAfterSeconds
  }
}

const appendQuery = (path: string, query: RequestQuery | undefined): string => {
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

const readJson = async (
  response: Response
): Promise<JsonResponse | undefined> => {
  const value = await response.json().catch(() => undefined)
  // SAFETY: the same-origin API contract returns JSON values in every response body.
  return value as JsonResponse | undefined
}

export const requestJson = async <ResponseBody, Payload = undefined>(
  path: string,
  { method = "GET", headers, payload, query, signal }: RequestOptions<Payload>,
  schema: Schema.ConstraintDecoder<ResponseBody>
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
  return Schema.decodeUnknownSync(schema)(body)
}

type MutationOptions<ResponseBody, Payload> = {
  readonly payload?: Payload
  readonly schema: Schema.ConstraintDecoder<ResponseBody>
}

const mutation = <ResponseBody, Payload = undefined>(
  path: string,
  method: "DELETE" | "PATCH" | "POST",
  { payload, schema }: MutationOptions<ResponseBody, Payload>
) => requestJson<ResponseBody, Payload>(path, { method, payload }, schema)

type PluginServerToggleInput = PluginServerParams & {
  readonly payload: TogglePluginServerPayload
}

const togglePluginServer = <ResponseBody>(
  suffix: string,
  input: PluginServerToggleInput,
  schema: Schema.ConstraintDecoder<ResponseBody>
): Promise<ResponseBody> =>
  mutation<ResponseBody, TogglePluginServerPayload>(
    `/api/plugin-servers/${encodeURIComponent(input.params.pluginServerId)}/${suffix}`,
    "POST",
    { payload: input.payload, schema }
  )

export const client = {
  pluginServers: {
    list: (): Promise<PluginServerList> =>
      requestJson<PluginServerList>(
        "/api/plugin-servers",
        {},
        PluginServerListSchema
      ),
    usage: (): Promise<PluginServerUsageList> =>
      requestJson<PluginServerUsageList>(
        "/api/plugin-servers/usage",
        {},
        PluginServerUsageListSchema
      ),
    create: (input: {
      readonly payload: CreatePluginServerPayload
    }): Promise<MutationResult> =>
      mutation<MutationResult, CreatePluginServerPayload>(
        "/api/plugin-servers",
        "POST",
        { payload: input.payload, schema: MutationResultSchema }
      ),
    toggle: (input: PluginServerToggleInput): Promise<MutationResult> =>
      togglePluginServer("toggle", input, MutationResultSchema),
    toggleProxy: (
      input: PluginServerToggleInput
    ): Promise<VersionedMutationResult> =>
      togglePluginServer("proxy-toggle", input, VersionedMutationResultSchema),
    refresh: (input: PluginServerParams): Promise<MutationResult> =>
      mutation<MutationResult>(
        `/api/plugin-servers/${encodeURIComponent(input.params.pluginServerId)}/refresh`,
        "POST",
        { schema: MutationResultSchema }
      ),
    setProxyKey: (
      input: PluginServerParams & {
        readonly payload: SetProxyKeyPayload
      }
    ): Promise<SetProxyKeyResponse> =>
      mutation<SetProxyKeyResponse, SetProxyKeyPayload>(
        `/api/plugin-servers/${encodeURIComponent(input.params.pluginServerId)}/proxy-key`,
        "POST",
        { payload: input.payload, schema: SetProxyKeyResponseSchema }
      ),
    refreshProxyBalance: (
      input: PluginServerParams
    ): Promise<RefreshProxyBalanceResponse> =>
      mutation<RefreshProxyBalanceResponse>(
        `/api/plugin-servers/${encodeURIComponent(input.params.pluginServerId)}/proxy-balance/refresh`,
        "POST",
        { schema: RefreshProxyBalanceResponseSchema }
      ),
    delete: (input: PluginServerParams): Promise<MutationResult> =>
      mutation<MutationResult>(
        `/api/plugin-servers/${encodeURIComponent(input.params.pluginServerId)}`,
        "DELETE",
        { schema: MutationResultSchema }
      ),
  },
  pluginDomains: {
    list: (): Promise<PluginDomainList> =>
      requestJson<PluginDomainList>(
        "/api/plugin-domains",
        {},
        PluginDomainListSchema
      ),
    create: (input: {
      readonly payload: CreatePluginDomainPayload
    }): Promise<MutationResult> =>
      mutation<MutationResult, CreatePluginDomainPayload>(
        "/api/plugin-domains",
        "POST",
        { payload: input.payload, schema: MutationResultSchema }
      ),
    setCredential: (
      input: PluginDomainParams & {
        readonly payload: SetCredentialPayload
      }
    ): Promise<MutationResult> =>
      mutation<MutationResult, SetCredentialPayload>(
        `/api/plugin-domains/${encodeURIComponent(input.params.domainId)}/credential`,
        "PATCH",
        { payload: input.payload, schema: MutationResultSchema }
      ),
    deleteCredential: (input: PluginDomainParams): Promise<MutationResult> =>
      mutation<MutationResult>(
        `/api/plugin-domains/${encodeURIComponent(input.params.domainId)}/credential`,
        "DELETE",
        { schema: MutationResultSchema }
      ),
    delete: (input: PluginDomainParams): Promise<MutationResult> =>
      mutation<MutationResult>(
        `/api/plugin-domains/${encodeURIComponent(input.params.domainId)}`,
        "DELETE",
        { schema: MutationResultSchema }
      ),
  },
  remote: {
    send: (input: {
      readonly payload: RemoteSendPayload
    }): Promise<MutationResult> =>
      mutation<MutationResult, RemoteSendPayload>("/api/remote/send", "POST", {
        payload: input.payload,
        schema: MutationResultSchema,
      }),
    pollInbox: (input: {
      readonly query: RemotePollQuery
    }): Promise<RemotePollResponse> =>
      requestJson<RemotePollResponse>(
        "/api/remote/inbox",
        { query: input.query },
        RemotePollResponseSchema
      ),
    reportResult: (input: {
      readonly payload: RemoteResultPayload
    }): Promise<MutationResult> =>
      mutation<MutationResult, RemoteResultPayload>(
        "/api/remote/result",
        "POST",
        { payload: input.payload, schema: MutationResultSchema }
      ),
  },
  settings: {
    touchActivity: (input: {
      readonly payload: ActivityPayload
    }): Promise<MutationResult> =>
      mutation<MutationResult, ActivityPayload>(
        "/api/settings/activity",
        "POST",
        { payload: input.payload, schema: MutationResultSchema }
      ),
    getPlayerPreferences: (): Promise<PlayerPreferences> =>
      requestJson<PlayerPreferences>(
        "/api/settings/player",
        {},
        PlayerPreferencesSchema
      ),
    updatePlayerPreferences: (input: {
      readonly payload: PlayerPreferences
    }): Promise<MutationResult> =>
      mutation<MutationResult, PlayerPreferences>(
        "/api/settings/player",
        "PATCH",
        { payload: input.payload, schema: MutationResultSchema }
      ),
    listSessions: (): Promise<UserSessionList> =>
      requestJson<UserSessionList>(
        "/api/settings/security/sessions",
        {},
        UserSessionListSchema
      ),
    revokeSession: (input: SessionParams): Promise<MutationResult> =>
      mutation<MutationResult>(
        `/api/settings/security/sessions/${encodeURIComponent(input.params.sessionId)}`,
        "DELETE",
        { schema: MutationResultSchema }
      ),
    revokeAllSessions: (): Promise<MutationResult> =>
      mutation<MutationResult>("/api/settings/security/sessions", "DELETE", {
        schema: MutationResultSchema,
      }),
    deleteAccount: (input: {
      readonly payload: DeleteAccountPayload
    }): Promise<MutationResult> =>
      mutation<MutationResult, DeleteAccountPayload>(
        "/api/settings/security/account",
        "DELETE",
        { payload: input.payload, schema: MutationResultSchema }
      ),
  },
}

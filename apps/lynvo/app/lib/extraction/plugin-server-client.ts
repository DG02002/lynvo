import {
  createNodeExtractRequest,
  createSourceExtractRequest,
  discoverResponseSchema,
  extractErrorSchema,
  isSupportedProtocolVersion,
  parseExtractSuccessContract,
  parsePluginServerManifestContract,
  parseUsageResponseContract,
  verifyErrorSchema,
  verifySuccessSchema,
  type ExtractSuccessResponse,
  type DiscoverResponse,
  type PluginServerManifest,
  type HttpBasicAuth,
  type UsageResponse,
} from "@dg02002/lynvo-plugin-server-protocol"
import type { JsonValue } from "@dg02002/lynvo-plugin-server-protocol"
import { Result, Schema } from "effect"
import {
  PLUGIN_SERVER_INTERNAL_ORIGIN,
  PLUGIN_SERVER_REQUEST_TIMEOUT_MS,
} from "../constants"
import { createOutboundHttpTransport } from "../outbound-http"

export interface PluginServerTransport {
  fetch: (request: Request) => Promise<Response>
}

export interface PluginServerClientOptions {
  apiKey?: string
  requestId?: string
  operationId?: string
}

export interface PluginServerRequestOptions extends PluginServerClientOptions {
  pluginId?: string
  password?: string
  basicAuth?: HttpBasicAuth
}

export interface PluginServerFailureDetails {
  code: string
  message: string
  status?: number
}

export class PluginServerClientError extends Error {
  readonly code: string
  readonly status?: number

  constructor(details: PluginServerFailureDetails) {
    super(details.message)
    this.name = "PluginServerClientError"
    this.code = details.code
    this.status = details.status
  }
}

export class HttpPluginServerTransport implements PluginServerTransport {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "")
  }

  fetch = async (request: Request): Promise<Response> => {
    const internalUrl = new URL(request.url)
    const method = request.method
    const body =
      method === "GET" || method === "HEAD"
        ? undefined
        : await request.arrayBuffer()
    const destination = `${this.baseUrl}${internalUrl.pathname}${internalUrl.search}`
    return createOutboundHttpTransport({
      allowLocalDevelopment: import.meta.env.DEV,
    }).fetch(destination, {
      method,
      headers: request.headers,
      body,
      signal: request.signal,
      protectedOrigin: new URL(this.baseUrl).origin,
      allowedProtocols: ["http:", "https:"],
      timeoutMs: PLUGIN_SERVER_REQUEST_TIMEOUT_MS,
    })
  }
}

export class ServiceBindingPluginServerTransport implements PluginServerTransport {
  private readonly binding: PluginServerTransport

  constructor(binding: PluginServerTransport) {
    this.binding = binding
  }

  fetch = (request: Request): Promise<Response> => this.binding.fetch(request)
}

const parseJson = async (response: Response): Promise<JsonValue> => {
  try {
    const data = await response.json()
    // SAFETY: Response JSON parsed from HTTP response is a valid JsonValue.
    return data as JsonValue
  } catch {
    throw new PluginServerClientError({
      code: "PROTOCOL_MISMATCH",
      message: "Plugin Server returned malformed JSON.",
      status: response.status,
    })
  }
}

const throwResponseFailure = <Value>(value: Value, status: number): never => {
  const extractError = Schema.decodeUnknownResult(extractErrorSchema)(value)
  if (Result.isSuccess(extractError)) {
    throw new PluginServerClientError({
      code: extractError.success.error.code,
      message: extractError.success.error.message,
      status,
    })
  }
  const verifyError = Schema.decodeUnknownResult(verifyErrorSchema)(value)
  throw new PluginServerClientError({
    code: Result.isSuccess(verifyError)
      ? verifyError.success.error.code
      : "PROTOCOL_MISMATCH",
    message: Result.isSuccess(verifyError)
      ? verifyError.success.error.message
      : `Plugin Server request failed with HTTP ${status}.`,
    status,
  })
}

export class PluginServerClient {
  private readonly transport: PluginServerTransport

  constructor(transport: PluginServerTransport) {
    this.transport = transport
  }

  private request = async (
    pathname: string,
    init: RequestInit,
    options: PluginServerClientOptions
  ): Promise<Response> => {
    const headers = new Headers(init.headers)
    if (options.apiKey) {
      headers.set("Authorization", `Bearer ${options.apiKey}`)
    }
    if (options.requestId) {
      headers.set("x-request-id", options.requestId)
    }
    if (options.operationId) {
      headers.set("x-operation-id", options.operationId)
    }
    try {
      return await this.transport.fetch(
        new Request(`${PLUGIN_SERVER_INTERNAL_ORIGIN}${pathname}`, {
          ...init,
          headers,
          signal: AbortSignal.timeout(PLUGIN_SERVER_REQUEST_TIMEOUT_MS),
        })
      )
    } catch (cause) {
      if (cause instanceof PluginServerClientError) {
        throw cause
      }
      throw new PluginServerClientError({
        code: "TEMPORARY_FAILURE",
        message: "Plugin Server request failed.",
      })
    }
  }

  getManifest = async (
    options: PluginServerClientOptions = {}
  ): Promise<PluginServerManifest> => {
    const response = await this.request("/manifest", { method: "GET" }, options)
    const value = await parseJson(response)
    if (!response.ok) {
      throwResponseFailure(value, response.status)
    }
    const parsed = parsePluginServerManifestContract(value)
    if (
      !parsed.ok ||
      !parsed.value ||
      !isSupportedProtocolVersion(parsed.value.protocolVersion)
    ) {
      throw new PluginServerClientError({
        code: "PROTOCOL_MISMATCH",
        message: "Plugin Server Manifest does not match protocol v1.",
      })
    }
    return parsed.value
  }

  verify = async (options: PluginServerClientOptions): Promise<void> => {
    const response = await this.request("/verify", { method: "POST" }, options)
    const value = await parseJson(response)
    if (!response.ok) {
      throwResponseFailure(value, response.status)
    }
    if (
      Result.isFailure(Schema.decodeUnknownResult(verifySuccessSchema)(value))
    ) {
      throw new PluginServerClientError({
        code: "PROTOCOL_MISMATCH",
        message: "Plugin Server verification response is invalid.",
      })
    }
  }

  getUsage = async (
    options: PluginServerClientOptions
  ): Promise<UsageResponse> => {
    const response = await this.request("/usage", { method: "GET" }, options)
    const value = await parseJson(response)
    if (!response.ok) {
      throwResponseFailure(value, response.status)
    }
    const parsed = parseUsageResponseContract(value)
    if (!parsed.ok || !parsed.value) {
      throw new PluginServerClientError({
        code: "PROTOCOL_MISMATCH",
        message: "Plugin Server usage response does not match protocol v1.",
      })
    }
    return parsed.value
  }

  discover = async (
    targetUrl: string,
    options: PluginServerClientOptions & { basicAuth?: HttpBasicAuth }
  ): Promise<DiscoverResponse> => {
    const response = await this.request(
      "/discover",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          options.basicAuth
            ? { url: targetUrl, basicAuth: options.basicAuth }
            : { url: targetUrl }
        ),
      },
      options
    )
    const value = await parseJson(response)
    if (!response.ok) {
      throwResponseFailure(value, response.status)
    }
    const parsed = Schema.decodeUnknownResult(discoverResponseSchema)(value)
    if (Result.isFailure(parsed)) {
      throw new PluginServerClientError({
        code: "PROTOCOL_MISMATCH",
        message: "Plugin Server discovery response does not match protocol v1.",
      })
    }
    return parsed.success
  }

  private extract = async (
    targetUrl: string,
    kind: "source" | "node",
    options: PluginServerRequestOptions
  ): Promise<ExtractSuccessResponse> => {
    const body =
      kind === "source"
        ? createSourceExtractRequest(
            targetUrl,
            options.password,
            options.basicAuth,
            options.pluginId
          )
        : createNodeExtractRequest(
            targetUrl,
            options.password,
            options.basicAuth,
            options.pluginId
          )
    const response = await this.request(
      "/extract",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      options
    )
    const value = await parseJson(response)
    if (!response.ok) {
      throwResponseFailure(value, response.status)
    }
    const parsed = parseExtractSuccessContract(value)
    if (!parsed.ok || !parsed.value) {
      throw new PluginServerClientError({
        code: "PROTOCOL_MISMATCH",
        message: "Plugin Server response does not match protocol v1.",
      })
    }
    return parsed.value
  }

  extractSource = (
    targetUrl: string,
    options: PluginServerRequestOptions
  ): Promise<ExtractSuccessResponse> =>
    this.extract(targetUrl, "source", options)

  extractNode = (
    targetUrl: string,
    options: PluginServerRequestOptions
  ): Promise<ExtractSuccessResponse> => this.extract(targetUrl, "node", options)
}

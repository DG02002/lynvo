import {
  createNodeExtractRequest,
  createSourceExtractRequest,
  extractErrorSchema,
  extractSuccessSchema,
  isSupportedProtocolVersion,
  manifestSchema,
  usageResponseSchema,
  validateExtractorManifestContract,
  validateUsageContract,
  verifyErrorSchema,
  verifySuccessSchema,
  type ExtractSuccessResponse,
  type ExtractorManifest,
  type HttpBasicAuth,
  type UsageResponse,
} from "@lynvo/extractor-protocol"
import {
  EXTRACTOR_INTERNAL_ORIGIN,
  EXTRACTOR_REQUEST_TIMEOUT_MS,
} from "../constants"

export interface ExtractorTransport {
  fetch: (request: Request) => Promise<Response>
}

export interface ExtractorClientOptions {
  apiKey?: string
  requestId?: string
}

export interface ExtractorRequestOptions extends ExtractorClientOptions {
  password?: string
  basicAuth?: HttpBasicAuth
}

export interface ExtractorProtocolFailureDetails {
  code: string
  message: string
  status?: number
}

export class ExtractorProtocolClientError extends Error {
  readonly code: string
  readonly status?: number

  constructor(details: ExtractorProtocolFailureDetails) {
    super(details.message)
    this.name = "ExtractorProtocolClientError"
    this.code = details.code
    this.status = details.status
  }
}

export class HttpExtractorTransport implements ExtractorTransport {
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
    return fetch(
      new Request(
        `${this.baseUrl}${internalUrl.pathname}${internalUrl.search}`,
        {
          method,
          headers: request.headers,
          body,
          signal: request.signal,
        }
      )
    )
  }
}

export class ServiceBindingExtractorTransport implements ExtractorTransport {
  private readonly binding: ExtractorTransport

  constructor(binding: ExtractorTransport) {
    this.binding = binding
  }

  fetch = (request: Request): Promise<Response> => this.binding.fetch(request)
}

const parseJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json()
  } catch {
    throw new ExtractorProtocolClientError({
      code: "PROTOCOL_MISMATCH",
      message: "Extractor returned malformed JSON.",
      status: response.status,
    })
  }
}

const throwResponseFailure = (value: unknown, status: number): never => {
  const extractError = extractErrorSchema.safeParse(value)
  if (extractError.success) {
    throw new ExtractorProtocolClientError({
      code: extractError.data.error.code,
      message: extractError.data.error.message,
      status,
    })
  }
  const verifyError = verifyErrorSchema.safeParse(value)
  throw new ExtractorProtocolClientError({
    code: verifyError.success
      ? verifyError.data.error.code
      : "PROTOCOL_MISMATCH",
    message: verifyError.success
      ? verifyError.data.error.message
      : `Extractor request failed with HTTP ${status}.`,
    status,
  })
}

export class ExtractorProtocolClient {
  private readonly transport: ExtractorTransport

  constructor(transport: ExtractorTransport) {
    this.transport = transport
  }

  private request = async (
    pathname: string,
    init: RequestInit,
    options: ExtractorClientOptions
  ): Promise<Response> => {
    const headers = new Headers(init.headers)
    if (options.apiKey) {
      headers.set("Authorization", `Bearer ${options.apiKey}`)
    }
    if (options.requestId) {
      headers.set("x-request-id", options.requestId)
    }
    try {
      return await this.transport.fetch(
        new Request(`${EXTRACTOR_INTERNAL_ORIGIN}${pathname}`, {
          ...init,
          headers,
          signal: AbortSignal.timeout(EXTRACTOR_REQUEST_TIMEOUT_MS),
        })
      )
    } catch (cause) {
      if (cause instanceof ExtractorProtocolClientError) {
        throw cause
      }
      throw new ExtractorProtocolClientError({
        code: "TEMPORARY_FAILURE",
        message: "Extractor request failed.",
      })
    }
  }

  getManifest = async (
    options: ExtractorClientOptions = {}
  ): Promise<ExtractorManifest> => {
    const response = await this.request("/manifest", { method: "GET" }, options)
    const value = await parseJson(response)
    if (!response.ok) {
      throwResponseFailure(value, response.status)
    }
    const parsed = manifestSchema.safeParse(value)
    const contract = validateExtractorManifestContract(value)
    if (
      !parsed.success ||
      !contract.ok ||
      !isSupportedProtocolVersion(parsed.data.protocolVersion)
    ) {
      throw new ExtractorProtocolClientError({
        code: "PROTOCOL_MISMATCH",
        message: "Extractor manifest does not match protocol v1.",
      })
    }
    return parsed.data
  }

  verify = async (options: ExtractorClientOptions): Promise<void> => {
    const response = await this.request("/verify", { method: "POST" }, options)
    const value = await parseJson(response)
    if (!response.ok) {
      throwResponseFailure(value, response.status)
    }
    if (!verifySuccessSchema.safeParse(value).success) {
      throw new ExtractorProtocolClientError({
        code: "PROTOCOL_MISMATCH",
        message: "Extractor verification response is invalid.",
      })
    }
  }

  getUsage = async (
    options: ExtractorClientOptions
  ): Promise<UsageResponse> => {
    const response = await this.request("/usage", { method: "GET" }, options)
    const value = await parseJson(response)
    if (!response.ok) {
      throwResponseFailure(value, response.status)
    }
    const parsed = usageResponseSchema.safeParse(value)
    const contract = validateUsageContract(value)
    if (!parsed.success || !contract.ok) {
      throw new ExtractorProtocolClientError({
        code: "PROTOCOL_MISMATCH",
        message: "Extractor usage response does not match protocol v1.",
      })
    }
    return parsed.data
  }

  private extract = async (
    targetUrl: string,
    kind: "source" | "node",
    options: ExtractorRequestOptions
  ): Promise<ExtractSuccessResponse> => {
    const body =
      kind === "source"
        ? createSourceExtractRequest(
            targetUrl,
            options.password,
            options.basicAuth
          )
        : createNodeExtractRequest(
            targetUrl,
            options.password,
            options.basicAuth
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
    const parsed = extractSuccessSchema.safeParse(value)
    if (!parsed.success) {
      throw new ExtractorProtocolClientError({
        code: "PROTOCOL_MISMATCH",
        message: "Extractor response does not match protocol v1.",
      })
    }
    return parsed.data
  }

  extractSource = (
    targetUrl: string,
    options: ExtractorRequestOptions
  ): Promise<ExtractSuccessResponse> =>
    this.extract(targetUrl, "source", options)

  extractNode = (
    targetUrl: string,
    options: ExtractorRequestOptions
  ): Promise<ExtractSuccessResponse> => this.extract(targetUrl, "node", options)
}

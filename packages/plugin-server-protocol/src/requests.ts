import type {
  ErrorCode,
  ExtractProtocolError,
  ExtractRequest,
  HttpBasicAuth,
  ProxyCredential,
} from "./models.js"

export interface ExtractRequestOptions {
  readonly password?: string
  readonly basicAuth?: HttpBasicAuth
  readonly pluginId?: string
  readonly proxy?: ProxyCredential
}

export interface CreateSourceExtractRequestOptions extends ExtractRequestOptions {
  readonly sourceUrl: string
}

export interface CreateNodeExtractRequestOptions extends ExtractRequestOptions {
  readonly nodeUrl: string
}

export const createProtocolError = (
  code: ErrorCode,
  message: string,
  retryAfterSeconds?: number
): ExtractProtocolError =>
  retryAfterSeconds === undefined
    ? {
        ok: false,
        error: { code, message },
        extensions: {},
      }
    : {
        ok: false,
        error: { code, message, retryAfterSeconds },
        extensions: {},
      }

const createExtractRequest = (
  input: ExtractRequest["input"],
  options: ExtractRequestOptions
): ExtractRequest => {
  let request: ExtractRequest = { input }
  if (options.pluginId) {
    request = { ...request, pluginId: options.pluginId }
  }
  if (options.password) {
    request = { ...request, password: options.password }
  }
  if (options.basicAuth) {
    request = { ...request, basicAuth: options.basicAuth }
  }
  if (options.proxy) {
    request = { ...request, proxy: options.proxy }
  }
  return request
}

export const createSourceExtractRequest = ({
  sourceUrl,
  ...options
}: CreateSourceExtractRequestOptions): ExtractRequest =>
  createExtractRequest({ kind: "source", sourceUrl }, options)

export const createNodeExtractRequest = ({
  nodeUrl,
  ...options
}: CreateNodeExtractRequestOptions): ExtractRequest =>
  createExtractRequest({ kind: "node", nodeUrl }, options)

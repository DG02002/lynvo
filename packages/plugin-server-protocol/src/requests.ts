import type {
  ErrorCode,
  ExtractProtocolError,
  ExtractRequest,
  ExtractedHttpBasicAuth,
  HttpBasicAuth,
} from "./models.js"
import { ERROR_CODES } from "./models.js"

export const createProtocolError = (
  code: ErrorCode,
  message: string,
  retryAfterSeconds?: number
): ExtractProtocolError => {
  const error: ExtractProtocolError = {
    ok: false,
    error: {
    code,
    message,
    },
    extensions: {},
  }
  if (retryAfterSeconds !== undefined) {
    error.error.retryAfterSeconds = retryAfterSeconds
  }
  return error
}

export const createSourceExtractRequest = (
  sourceUrl: string,
  password?: string,
  basicAuth?: HttpBasicAuth,
  pluginId?: string
): ExtractRequest => {
  const request: ExtractRequest = {
    input: {
    kind: "source",
    sourceUrl,
    },
  }
  if (pluginId) {
    request.pluginId = pluginId
  }
  if (password) {
    request.password = password
  }
  if (basicAuth) {
    request.basicAuth = basicAuth
  }
  return request
}

export const createNodeExtractRequest = (
  nodeUrl: string,
  password?: string,
  basicAuth?: HttpBasicAuth,
  pluginId?: string
): ExtractRequest => {
  const request: ExtractRequest = {
    input: {
    kind: "node",
    nodeUrl,
    },
  }
  if (pluginId) {
    request.pluginId = pluginId
  }
  if (password) {
    request.password = password
  }
  if (basicAuth) {
    request.basicAuth = basicAuth
  }
  return request
}

export const extractHttpBasicAuth = (
  sourceUrl: string
): ExtractedHttpBasicAuth => {
  const url = new URL(sourceUrl)
  if (!url.username && !url.password) {
    return { url: url.toString() }
  }

  const basicAuth = {
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  }
  url.username = ""
  url.password = ""
  return { url: url.toString(), basicAuth }
}

export const applyHttpBasicAuth = (
  sourceUrl: string,
  basicAuth?: HttpBasicAuth
): string => {
  if (!basicAuth) {
    return sourceUrl
  }

  const url = new URL(sourceUrl)
  url.username = basicAuth.username
  url.password = basicAuth.password
  return url.toString()
}

export const isErrorCode = (code: string): code is ErrorCode =>
  new Set<string>(ERROR_CODES).has(code)

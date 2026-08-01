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
): ExtractProtocolError => ({
  ok: false,
  error: {
    code,
    message,
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  },
  extensions: {},
})

export const createSourceExtractRequest = (
  sourceUrl: string,
  password?: string,
  basicAuth?: HttpBasicAuth,
  pluginId?: string
): ExtractRequest => ({
  input: {
    kind: "source",
    sourceUrl,
  },
  ...(pluginId ? { pluginId } : {}),
  ...(password ? { password } : {}),
  ...(basicAuth ? { basicAuth } : {}),
})

export const createNodeExtractRequest = (
  nodeUrl: string,
  password?: string,
  basicAuth?: HttpBasicAuth,
  pluginId?: string
): ExtractRequest => ({
  input: {
    kind: "node",
    nodeUrl,
  },
  ...(pluginId ? { pluginId } : {}),
  ...(password ? { password } : {}),
  ...(basicAuth ? { basicAuth } : {}),
})

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
  (ERROR_CODES as readonly string[]).includes(code)

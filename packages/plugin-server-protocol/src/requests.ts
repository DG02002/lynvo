import type {
  ErrorCode,
  ExtractProtocolError,
  ExtractRequest,
  ExtractedHttpBasicAuth,
  HttpBasicAuth,
  ProxyCredential,
} from "./models.js"
import { ERROR_CODES } from "./models.js"

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

export const createSourceExtractRequest = (
  sourceUrl: string,
  password?: string,
  basicAuth?: HttpBasicAuth,
  pluginId?: string,
  proxy?: ProxyCredential
): ExtractRequest => {
  const input = { kind: "source" as const, sourceUrl }
  const request = { input }
  const withPluginId = pluginId ? { ...request, pluginId } : request
  const withPassword = password ? { ...withPluginId, password } : withPluginId
  const withBasicAuth = basicAuth
    ? { ...withPassword, basicAuth }
    : withPassword
  return proxy ? { ...withBasicAuth, proxy } : withBasicAuth
}

export const createNodeExtractRequest = (
  nodeUrl: string,
  password?: string,
  basicAuth?: HttpBasicAuth,
  pluginId?: string,
  proxy?: ProxyCredential
): ExtractRequest => {
  const input = { kind: "node" as const, nodeUrl }
  const request = { input }
  const withPluginId = pluginId ? { ...request, pluginId } : request
  const withPassword = password ? { ...withPluginId, password } : withPluginId
  const withBasicAuth = basicAuth
    ? { ...withPassword, basicAuth }
    : withPassword
  return proxy ? { ...withBasicAuth, proxy } : withBasicAuth
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

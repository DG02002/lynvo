import type {
  ErrorCode,
  ExtractProtocolError,
  ExtractRequest,
  HttpBasicAuth,
  ProxyCredential,
} from "./models.js"

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

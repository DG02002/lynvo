import {
  UPSTREAM_REDIRECT_LIMIT,
  UPSTREAM_RESPONSE_BYTE_LIMIT,
  UPSTREAM_TIMEOUT_MS,
} from "./constants"
import { assertSafeUpstreamUrl } from "./url-policy"
import type { JsonValue } from "@dg02002/lynvo-plugin-server-protocol"

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const REDIRECT_REQUEST_BODY_HEADERS = [
  "Content-Encoding",
  "Content-Language",
  "Content-Location",
  "Content-Type",
] as const
const REDIRECT_CREDENTIAL_HEADERS = [
  "Authorization",
  "od-protected-token",
] as const

export class UpstreamPolicyError extends Error {}

const normalizeRedirectRequest = (
  status: number,
  redirect: { currentUrl: URL; nextUrl: URL },
  options: RequestInit
): RequestInit => {
  const method = (options.method ?? "GET").toUpperCase()
  const shouldConvertToGet =
    ((status === 301 || status === 302) && method === "POST") ||
    (status === 303 && method !== "GET" && method !== "HEAD")
  const isCrossOrigin = redirect.currentUrl.origin !== redirect.nextUrl.origin

  if (!shouldConvertToGet && !isCrossOrigin) {
    return options
  }

  const headers = new Headers(options.headers)
  if (shouldConvertToGet) {
    for (const headerName of REDIRECT_REQUEST_BODY_HEADERS) {
      headers.delete(headerName)
    }
  }
  if (isCrossOrigin) {
    for (const headerName of REDIRECT_CREDENTIAL_HEADERS) {
      headers.delete(headerName)
    }
  }

  const nextOptions: RequestInit = { ...options, headers }
  if (shouldConvertToGet) {
    nextOptions.method = "GET"
    nextOptions.body = null
  }
  return nextOptions
}

const validateUpstreamUrl = (targetUrl: string): URL => {
  try {
    return assertSafeUpstreamUrl(targetUrl)
  } catch {
    throw new UpstreamPolicyError("Upstream destination is not allowed.")
  }
}

const fetchValidatedUpstreamUrl = async (
  currentUrl: URL,
  options: RequestInit,
  redirectCount: number
): Promise<Response> => {
  const response = await fetch(currentUrl, {
    ...options,
    redirect: "manual",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  })
  if (!REDIRECT_STATUSES.has(response.status)) {
    return response
  }
  let nextUrl: URL
  try {
    if (redirectCount >= UPSTREAM_REDIRECT_LIMIT) {
      throw new Error("Upstream redirect limit exceeded.")
    }
    const location = response.headers.get("Location")
    if (!location) {
      throw new Error("Upstream redirect omitted its destination.")
    }
    nextUrl = validateUpstreamUrl(new URL(location, currentUrl).toString())
  } finally {
    await response.body?.cancel()
  }
  return fetchValidatedUpstreamUrl(
    nextUrl,
    normalizeRedirectRequest(response.status, { currentUrl, nextUrl }, options),
    redirectCount + 1
  )
}

export const fetchValidatedUpstream = (
  targetUrl: string | URL,
  options: RequestInit
): Promise<Response> =>
  fetchValidatedUpstreamUrl(
    validateUpstreamUrl(targetUrl.toString()),
    options,
    0
  )

export const readBoundedUpstreamText = async (
  response: Response
): Promise<string> => {
  const declaredLength = Number(response.headers.get("Content-Length"))
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > UPSTREAM_RESPONSE_BYTE_LIMIT
  ) {
    await response.body?.cancel()
    throw new Error("Upstream response exceeded its byte limit.")
  }
  if (!response.body) {
    return ""
  }
  const reader = response.body.getReader()
  const readChunks = async (
    chunks: Uint8Array[],
    byteCount: number
  ): Promise<{ chunks: Uint8Array[]; byteCount: number }> => {
    const result = await reader.read()
    if (result.done) {
      return { chunks, byteCount }
    }
    const nextByteCount = byteCount + result.value.byteLength
    if (nextByteCount > UPSTREAM_RESPONSE_BYTE_LIMIT) {
      await reader.cancel()
      throw new Error("Upstream response exceeded its byte limit.")
    }
    chunks.push(result.value)
    return readChunks(chunks, nextByteCount)
  }
  const { chunks, byteCount } = await readChunks([], 0)
  const bytes = new Uint8Array(byteCount)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

export const readBoundedUpstreamJson = async (
  response: Response
): Promise<JsonValue> => {
  const text = await readBoundedUpstreamText(response)
  // SAFETY: JSON.parse on bounded upstream text produces a valid JSON value.
  return JSON.parse(text) as JsonValue
}

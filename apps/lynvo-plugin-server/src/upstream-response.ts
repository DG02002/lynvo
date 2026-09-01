import {
  UPSTREAM_REDIRECT_LIMIT,
  UPSTREAM_RESPONSE_BYTE_LIMIT,
  UPSTREAM_TIMEOUT_MS,
} from "./constants"
import { assertSafeUpstreamUrl } from "./url-policy"
import type { JsonValue } from "@dg02002/lynvo-plugin-server-protocol"

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

export class UpstreamPolicyError extends Error {}

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
  if (redirectCount >= UPSTREAM_REDIRECT_LIMIT) {
    throw new Error("Upstream redirect limit exceeded.")
  }
  const location = response.headers.get("Location")
  if (!location) {
    throw new Error("Upstream redirect omitted its destination.")
  }
  const nextUrl = validateUpstreamUrl(new URL(location, currentUrl).toString())
  return fetchValidatedUpstreamUrl(nextUrl, options, redirectCount + 1)
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

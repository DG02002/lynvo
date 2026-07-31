import {
  UPSTREAM_REDIRECT_LIMIT,
  UPSTREAM_RESPONSE_BYTE_LIMIT,
  UPSTREAM_TIMEOUT_MS,
} from "./constants"
import { assertSafeUpstreamUrl } from "./url-policy"

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

export class UpstreamPolicyError extends Error {}

const validateUpstreamUrl = (targetUrl: string): URL => {
  try {
    return assertSafeUpstreamUrl(targetUrl)
  } catch {
    throw new UpstreamPolicyError("Upstream destination is not allowed.")
  }
}

export const fetchValidatedUpstream = async (
  targetUrl: string | URL,
  options: RequestInit
): Promise<Response> => {
  let currentUrl = validateUpstreamUrl(targetUrl.toString())
  for (
    let redirectCount = 0;
    redirectCount <= UPSTREAM_REDIRECT_LIMIT;
    redirectCount += 1
  ) {
    const response = await fetch(currentUrl, {
      ...options,
      redirect: "manual",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
    if (!REDIRECT_STATUSES.has(response.status)) {
      return response
    }
    if (redirectCount === UPSTREAM_REDIRECT_LIMIT) {
      throw new Error("Upstream redirect limit exceeded.")
    }
    const location = response.headers.get("Location")
    if (!location) {
      throw new Error("Upstream redirect omitted its destination.")
    }
    currentUrl = validateUpstreamUrl(new URL(location, currentUrl).toString())
  }
  throw new Error("Upstream redirect limit exceeded.")
}

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
  const chunks: Uint8Array[] = []
  let byteCount = 0
  while (true) {
    const result = await reader.read()
    if (result.done) {
      break
    }
    byteCount += result.value.byteLength
    if (byteCount > UPSTREAM_RESPONSE_BYTE_LIMIT) {
      await reader.cancel()
      throw new Error("Upstream response exceeded its byte limit.")
    }
    chunks.push(result.value)
  }
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
): Promise<unknown> => JSON.parse(await readBoundedUpstreamText(response))

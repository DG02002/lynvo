import {
  fetchValidatedRedirects,
  readBoundedResponseJson,
  readBoundedResponseText,
  ValidatedFetchError,
  type ReadBoundedResponseOptions,
  type JsonValue,
} from "@dg02002/lynvo-plugin-server-protocol"
import {
  UPSTREAM_REDIRECT_LIMIT,
  UPSTREAM_RESPONSE_BYTE_LIMIT,
  UPSTREAM_TIMEOUT_MS,
} from "./constants"
import { assertSafeUpstreamUrl } from "./url-policy"

const REDIRECT_CREDENTIAL_HEADERS = [
  "Authorization",
  "od-protected-token",
] as const

export class UpstreamPolicyError extends Error {}

const validateUpstreamUrl = (targetUrl: string): URL => {
  try {
    return assertSafeUpstreamUrl(targetUrl)
  } catch {
    throw new UpstreamPolicyError("Upstream destination is not allowed.")
  }
}

const toUpstreamError = (error: ValidatedFetchError): never => {
  switch (error.code) {
    case "TOO_MANY_REDIRECTS":
      throw new Error("Upstream redirect limit exceeded.")
    case "INVALID_REDIRECT":
      throw new Error("Upstream redirect omitted its destination.")
    case "RESPONSE_TOO_LARGE":
      throw new Error("Upstream response exceeded its byte limit.")
  }
}

export const fetchValidatedUpstream = async (
  targetUrl: string | URL,
  options: RequestInit
): Promise<Response> => {
  try {
    return await fetchValidatedRedirects(targetUrl, options, {
      validateUrl: (value) => validateUpstreamUrl(value.toString()),
      maxRedirects: UPSTREAM_REDIRECT_LIMIT,
      timeoutMs: UPSTREAM_TIMEOUT_MS,
      maximumResponseBytes: UPSTREAM_RESPONSE_BYTE_LIMIT,
      responseBodyMode: "stream",
      stripHeadersOnCrossOrigin: REDIRECT_CREDENTIAL_HEADERS,
    })
  } catch (error) {
    if (error instanceof ValidatedFetchError) {
      toUpstreamError(error)
    }
    throw error
  }
}

export const readBoundedUpstreamText = async (
  response: Response
): Promise<string> => {
  try {
    return await readBoundedResponseText(response, {
      maximumResponseBytes: UPSTREAM_RESPONSE_BYTE_LIMIT,
    })
  } catch (error) {
    if (error instanceof ValidatedFetchError) {
      toUpstreamError(error)
    }
    throw error
  }
}

export const readBoundedUpstreamJson = async (
  response: Response
): Promise<JsonValue> => {
  const options: ReadBoundedResponseOptions = {
    maximumResponseBytes: UPSTREAM_RESPONSE_BYTE_LIMIT,
  }
  try {
    return await readBoundedResponseJson(response, options)
  } catch (error) {
    if (error instanceof ValidatedFetchError) {
      toUpstreamError(error)
    }
    throw error
  }
}

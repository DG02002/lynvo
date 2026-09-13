import {
  fetchValidatedRedirects,
  readBoundedResponseJson,
  readBoundedResponseText,
  ValidatedFetchError,
  type JsonValue,
  type ValidatedFetchErrorCode,
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

const UPSTREAM_ERROR_MESSAGES = {
  TOO_MANY_REDIRECTS: "Upstream redirect limit exceeded.",
  INVALID_REDIRECT: "Upstream redirect omitted its destination.",
  RESPONSE_TOO_LARGE: "Upstream response exceeded its byte limit.",
} satisfies Readonly<Record<ValidatedFetchErrorCode, string>>

const throwUpstreamError = (error: ValidatedFetchError): never => {
  throw new Error(UPSTREAM_ERROR_MESSAGES[error.code])
}

const withUpstreamErrors = async <Value>(
  operation: () => Promise<Value>
): Promise<Value> => {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof ValidatedFetchError) {
      throwUpstreamError(error)
    }
    throw error
  }
}

export const fetchValidatedUpstream = (
  targetUrl: string | URL,
  options: RequestInit
): Promise<Response> =>
  withUpstreamErrors(() =>
    fetchValidatedRedirects(targetUrl, options, {
      validateUrl: (value) => validateUpstreamUrl(value.toString()),
      maxRedirects: UPSTREAM_REDIRECT_LIMIT,
      timeoutMs: UPSTREAM_TIMEOUT_MS,
      maximumResponseBytes: UPSTREAM_RESPONSE_BYTE_LIMIT,
      responseBodyMode: "stream",
      stripHeadersOnCrossOrigin: REDIRECT_CREDENTIAL_HEADERS,
    })
  )

export const readBoundedUpstreamText = (response: Response): Promise<string> =>
  withUpstreamErrors(() =>
    readBoundedResponseText(response, {
      maximumResponseBytes: UPSTREAM_RESPONSE_BYTE_LIMIT,
    })
  )

export const readBoundedUpstreamJson = (
  response: Response
): Promise<JsonValue> =>
  withUpstreamErrors(() =>
    readBoundedResponseJson(response, {
      maximumResponseBytes: UPSTREAM_RESPONSE_BYTE_LIMIT,
    })
  )

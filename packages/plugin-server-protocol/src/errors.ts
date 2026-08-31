import type { ErrorCode, ExtractProtocolError } from "./models.js"
import { createProtocolError } from "./requests.js"

/**
 * Typed extract failure. Throw it from a Plugin Server's extract
 * implementation and the runtime maps it to the protocol error envelope,
 * the documented HTTP status, and a Retry-After header when one applies.
 * Prefer this over throwing magic error-message strings.
 */
export class ProtocolError extends Error {
  readonly code: ErrorCode
  readonly retryAfterSeconds?: number

  constructor(
    code: ErrorCode,
    message: string,
    options?: { readonly retryAfterSeconds?: number }
  ) {
    super(message)
    this.name = "ProtocolError"
    this.code = code
    this.retryAfterSeconds = options?.retryAfterSeconds
  }
}

/** Documented mapping from protocol error codes to HTTP response statuses. */
export const PROTOCOL_ERROR_STATUS = {
  UNSUPPORTED_URL: 400,
  BAD_REQUEST: 400,
  AUTH_INVALID: 401,
  AUTH_REQUIRED: 401,
  PASSWORD_REQUIRED: 401,
  INVALID_PASSWORD: 401,
  NODE_EXPIRED: 410,
  RATE_LIMITED: 429,
  TEMPORARY_FAILURE: 500,
  PERMANENT_FAILURE: 500,
  PROTOCOL_MISMATCH: 500,
} as const satisfies Readonly<Record<ErrorCode, number>>

export const isProtocolError = (cause: unknown): cause is ProtocolError =>
  cause instanceof ProtocolError

export const toProtocolErrorResponse = (error: ProtocolError): Response => {
  const body: ExtractProtocolError = createProtocolError(
    error.code,
    error.message,
    error.retryAfterSeconds
  )
  const headers = new Headers({ "content-type": "application/json" })
  if (error.retryAfterSeconds !== undefined) {
    headers.set("retry-after", String(error.retryAfterSeconds))
  }
  return new Response(JSON.stringify(body), {
    status: PROTOCOL_ERROR_STATUS[error.code],
    headers,
  })
}

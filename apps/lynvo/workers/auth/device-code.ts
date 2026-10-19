import { Result, Schema } from "effect"
import type { Context as HonoContext } from "hono"

import { deviceCodeRequestSchema } from "../../app/lib/auth-gateway-schemas"
import type { RateLimitResult } from "../authentication-rate-limit"
import { requestApiError } from "../request-api-error"
import {
  addRequestContext,
  recordRateLimitResult,
  type RequestLoggingEnvironment,
} from "../request-logging"

export const readDeviceCodeRequestName = async (
  context: HonoContext<RequestLoggingEnvironment>
): Promise<string | Response> => {
  try {
    const result = Schema.decodeUnknownResult(deviceCodeRequestSchema)(
      await context.req.json()
    )
    if (Result.isFailure(result)) {
      return context.json(
        requestApiError(context, {
          code: "invalid_request",
          error: "Send a valid request.",
          retryable: false,
        }),
        400
      )
    }
    return result.success.deviceName
  } catch {
    return context.json(
      requestApiError(context, {
        code: "invalid_request",
        error: "Send a valid request.",
        retryable: false,
      }),
      400
    )
  }
}

export const createDeviceCodeRateLimitResponse = (
  context: HonoContext<RequestLoggingEnvironment>,
  rateLimitResult: RateLimitResult
): Response | undefined => {
  if (rateLimitResult.status === "allowed") {
    return undefined
  }
  if (rateLimitResult.status === "limited") {
    recordRateLimitResult(context, rateLimitResult)
    return context.json(
      requestApiError(context, {
        code: "rate_limited",
        error: "Too many attempts. Try again later.",
        retryable: true,
      }),
      429
    )
  }
  addRequestContext(context, {
    configuration_error: "auth_rate_limiter_unavailable",
  })
  return context.json(
    requestApiError(context, {
      code: "service_unavailable",
      error: "Device sign-in is unavailable. Try again later.",
      retryable: true,
    }),
    503
  )
}

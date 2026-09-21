import { Result, Schema } from "effect"

import {
  DEVICE_APPROVAL_RATE_LIMIT,
  DEVICE_APPROVAL_RATE_WINDOW_SECONDS,
} from "./constants"
import { getClientIp } from "./request-client-ip"

export type AuthenticationRateLimitStatus =
  | "allowed"
  | "limited"
  | "unavailable"

interface AuthenticationRateLimitLimitedResult {
  readonly status: "limited"
  readonly expiresAt: number
}

export type AuthenticationRateLimitResult =
  | AuthenticationRateLimitStatus
  | AuthenticationRateLimitLimitedResult

export const getAuthenticationRateLimitExpiresAt = (
  result: AuthenticationRateLimitResult
): number | undefined => {
  if (
    result === "allowed" ||
    result === "limited" ||
    result === "unavailable"
  ) {
    return undefined
  }
  return result.expiresAt
}

interface AuthenticationRateLimitEnvironment {
  readonly ENVIRONMENT?: string
  readonly AUTH_RATE_LIMITER?: DurableObjectNamespace
}

interface CheckRateLimitInput {
  readonly environment: AuthenticationRateLimitEnvironment
  readonly key: string
  readonly limit: number
  readonly windowSeconds: number
  readonly includeExpiresAt?: boolean
}

const rateLimitResponseSchema = Schema.Struct({
  allowed: Schema.Boolean,
  expiresAt: Schema.Number,
})

const readRateLimitExpiresAt = async (
  response: Response
): Promise<number | undefined> => {
  // A malformed limiter response keeps the existing limited outcome without a header.
  const payload = await response.json().catch(() => null)
  const result = Schema.decodeUnknownResult(rateLimitResponseSchema)(payload)
  if (Result.isFailure(result) || !Number.isFinite(result.success.expiresAt)) {
    return undefined
  }
  return result.success.expiresAt
}

export function checkRateLimit(
  input: CheckRateLimitInput & { readonly includeExpiresAt: true }
): Promise<AuthenticationRateLimitResult>
export function checkRateLimit(
  input: CheckRateLimitInput
): Promise<AuthenticationRateLimitStatus>
export async function checkRateLimit({
  environment,
  key,
  limit,
  windowSeconds,
  includeExpiresAt = false,
}: CheckRateLimitInput): Promise<AuthenticationRateLimitResult> {
  const limiter = environment.AUTH_RATE_LIMITER
  if (!limiter) {
    return environment.ENVIRONMENT === "production" ? "unavailable" : "allowed"
  }
  try {
    const response = await limiter
      .getByName(key)
      .fetch("https://auth-rate-limiter/attempt", {
        method: "POST",
        body: JSON.stringify({
          limit,
          nowMs: Date.now(),
          windowMs: windowSeconds * 1_000,
        }),
      })
    if (response.status === 200) {
      return "allowed"
    }
    if (response.status !== 429) {
      return "unavailable"
    }
    if (!includeExpiresAt) {
      return "limited"
    }
    const expiresAt = await readRateLimitExpiresAt(response)
    return expiresAt === undefined
      ? "limited"
      : { status: "limited", expiresAt }
  } catch {
    return "unavailable"
  }
}

interface CheckDeviceApprovalRateLimitInput {
  readonly environment: AuthenticationRateLimitEnvironment
  readonly request: Request
  readonly userId: string
}

// Keep this check on the non-bypassing path: with a limiter binding present,
// approval reads exercise the production abuse-control path in development.
export const checkDeviceApprovalRateLimit = ({
  environment,
  request,
  userId,
}: CheckDeviceApprovalRateLimitInput): Promise<AuthenticationRateLimitStatus> =>
  checkRateLimit({
    environment,
    key: `auth:device-approval:${getClientIp(request)}:${userId}`,
    limit: DEVICE_APPROVAL_RATE_LIMIT,
    windowSeconds: DEVICE_APPROVAL_RATE_WINDOW_SECONDS,
  })

interface CheckAuthenticationRateLimitInput {
  readonly environment: AuthenticationRateLimitEnvironment
  readonly key: string
  readonly limit: number
  readonly windowSeconds: number
}

export const checkAuthenticationRateLimit = ({
  environment,
  key,
  limit,
  windowSeconds,
}: CheckAuthenticationRateLimitInput): Promise<AuthenticationRateLimitStatus> =>
  environment.ENVIRONMENT === "development"
    ? Promise.resolve("allowed")
    : checkRateLimit({
        environment,
        key,
        limit,
        windowSeconds,
      })

import { RATE_LIMIT_EXPIRES_AT_HEADER } from "./auth-rate-limiter"
import {
  DEVICE_APPROVAL_RATE_LIMIT,
  DEVICE_APPROVAL_RATE_WINDOW_SECONDS,
} from "./constants"
import { getClientIp } from "./request-client-ip"

type RateLimitStatus = "allowed" | "limited" | "unavailable"

export interface RateLimitResult {
  readonly status: RateLimitStatus
  readonly expiresAt?: number
}

interface RateLimitEnvironment {
  readonly ENVIRONMENT?: string
  readonly AUTH_RATE_LIMITER?: DurableObjectNamespace
}

interface CheckRateLimitInput {
  readonly environment: RateLimitEnvironment
  readonly key: string
  readonly limit: number
  readonly windowSeconds: number
}

const MAX_RATE_LIMIT_EXPIRES_AT_LENGTH = 32

const readRateLimitExpiresAt = (response: Response): number | undefined => {
  const value = response.headers.get(RATE_LIMIT_EXPIRES_AT_HEADER)
  if (!value || value.length > MAX_RATE_LIMIT_EXPIRES_AT_LENGTH) {
    return undefined
  }
  const expiresAt = Number(value)
  return Number.isSafeInteger(expiresAt) && expiresAt >= 0
    ? expiresAt
    : undefined
}

export const checkRateLimit = async ({
  environment,
  key,
  limit,
  windowSeconds,
}: CheckRateLimitInput): Promise<RateLimitResult> => {
  const limiter = environment.AUTH_RATE_LIMITER
  if (!limiter) {
    return {
      status:
        environment.ENVIRONMENT === "production" ? "unavailable" : "allowed",
    }
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
      return { status: "allowed" }
    }
    if (response.status !== 429) {
      return { status: "unavailable" }
    }
    const expiresAt = readRateLimitExpiresAt(response)
    return expiresAt === undefined
      ? { status: "limited" }
      : { status: "limited", expiresAt }
  } catch {
    return { status: "unavailable" }
  }
}

interface CheckDeviceApprovalRateLimitInput {
  readonly environment: RateLimitEnvironment
  readonly request: Request
  readonly userId: string
}

// Keep this check on the non-bypassing path: with a limiter binding present,
// approval reads exercise the production abuse-control path in development.
export const checkDeviceApprovalRateLimit = ({
  environment,
  request,
  userId,
}: CheckDeviceApprovalRateLimitInput): Promise<RateLimitResult> =>
  checkRateLimit({
    environment,
    key: `auth:device-approval:${getClientIp(request)}:${userId}`,
    limit: DEVICE_APPROVAL_RATE_LIMIT,
    windowSeconds: DEVICE_APPROVAL_RATE_WINDOW_SECONDS,
  })

interface CheckAuthenticationRateLimitInput {
  readonly environment: RateLimitEnvironment
  readonly key: string
  readonly limit: number
  readonly windowSeconds: number
}

export const checkAuthenticationRateLimit = ({
  environment,
  key,
  limit,
  windowSeconds,
}: CheckAuthenticationRateLimitInput): Promise<RateLimitResult> =>
  environment.ENVIRONMENT === "development"
    ? Promise.resolve({ status: "allowed" })
    : checkRateLimit({
        environment,
        key,
        limit,
        windowSeconds,
      })

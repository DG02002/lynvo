import {
  DEVICE_APPROVAL_RATE_LIMIT,
  DEVICE_APPROVAL_RATE_WINDOW_SECONDS,
} from "./constants"
import { getClientIp } from "./request-client-ip"

export type AuthenticationRateLimitResult =
  | "allowed"
  | "limited"
  | "unavailable"

interface AuthenticationRateLimitEnvironment {
  readonly ENVIRONMENT?: string
  readonly AUTH_RATE_LIMITER?: DurableObjectNamespace
}

interface CheckRateLimitInput {
  readonly environment: AuthenticationRateLimitEnvironment
  readonly key: string
  readonly limit: number
  readonly windowSeconds: number
}

export const checkRateLimit = async ({
  environment,
  key,
  limit,
  windowSeconds,
}: CheckRateLimitInput): Promise<AuthenticationRateLimitResult> => {
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
    return response.status === 429 ? "limited" : "unavailable"
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
}: CheckDeviceApprovalRateLimitInput): Promise<AuthenticationRateLimitResult> =>
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
}: CheckAuthenticationRateLimitInput): Promise<AuthenticationRateLimitResult> =>
  environment.ENVIRONMENT === "development"
    ? Promise.resolve("allowed")
    : checkRateLimit({
        environment,
        key,
        limit,
        windowSeconds,
      })

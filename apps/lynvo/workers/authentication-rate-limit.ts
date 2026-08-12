export type AuthenticationRateLimitResult =
  | "allowed"
  | "limited"
  | "unavailable"

interface AuthenticationRateLimitEnvironment {
  readonly ENVIRONMENT?: string
  readonly AUTH_RATE_LIMITER?: DurableObjectNamespace
}

export const checkRateLimit = async (
  env: AuthenticationRateLimitEnvironment,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<AuthenticationRateLimitResult> => {
  const limiter = env.AUTH_RATE_LIMITER
  if (!limiter) {
    return env.ENVIRONMENT === "production" ? "unavailable" : "allowed"
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

export const checkAuthenticationRateLimit = (
  env: AuthenticationRateLimitEnvironment,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<AuthenticationRateLimitResult> =>
  env.ENVIRONMENT === "development"
    ? Promise.resolve("allowed")
    : checkRateLimit(env, key, limit, windowSeconds)

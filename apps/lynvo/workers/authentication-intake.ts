import { signAuthPreflightToken } from "../app/lib/auth-gateway"
import {
  authPreflightRequestSchema,
  deviceCodeRequestSchema,
} from "../app/lib/auth-gateway-schemas"
import { normalizeUsername, validateUsername } from "../app/lib/auth-policy"
import {
  AUTH_PREFLIGHT_RATE_WINDOW_SECONDS,
  AUTH_PREFLIGHT_TTL_MS,
  AUTH_SIGN_IN_RATE_LIMIT,
  AUTH_SIGN_UP_RATE_LIMIT,
  DEVICE_CODE_CREATION_RATE_LIMIT,
  DEVICE_CODE_CREATION_RATE_WINDOW_SECONDS,
  DEVICE_CODE_PREFLIGHT_TTL_MS,
} from "../convex/constants"

export interface AuthenticationIntakeRateLimitInput {
  readonly key: string
  readonly limit: number
  readonly windowSeconds: number
}

export interface AuthenticationIntakeDependencies {
  readonly gatewaySecret?: string
  readonly now: () => number
  readonly clientIp: (request: Request) => string
  readonly rateLimit: (
    input: AuthenticationIntakeRateLimitInput
  ) => Promise<"allowed" | "limited" | "unavailable">
  readonly verifyTurnstile: (
    request: Request,
    token: string | undefined,
    expectedAction: "lynvo-sign-in" | "lynvo-sign-up"
  ) => Promise<boolean>
  readonly generateDeviceCode: (
    deviceName: string,
    preflightToken: string
  ) => Promise<Record<string, unknown>>
}

export interface AuthenticationIntakeObservability {
  readonly auth_flow?: "signIn" | "signUp"
  readonly configuration_error?: string
  readonly rate_limit?: { readonly allowed: boolean }
  readonly turnstile?: { readonly verified: boolean }
  readonly error?: { readonly type: string; readonly message: string }
}

export interface AuthenticationIntakeSuccess {
  readonly kind: "success"
  readonly body: Record<string, unknown>
  readonly observability: AuthenticationIntakeObservability
}

export interface AuthenticationIntakeFailure {
  readonly kind: "failure"
  readonly status: 400 | 403 | 429 | 503
  readonly error: {
    readonly code:
      | "forbidden"
      | "invalid_request"
      | "service_unavailable"
      | "rate_limited"
      | "security_check_required"
    readonly error: string
    readonly retryable: boolean
  }
  readonly observability: AuthenticationIntakeObservability
}

export interface AuthenticationIntake {
  readonly preflight: (
    request: Request
  ) => Promise<AuthenticationIntakeSuccess | AuthenticationIntakeFailure>
  readonly createDeviceCode: (
    request: Request
  ) => Promise<AuthenticationIntakeSuccess | AuthenticationIntakeFailure>
}

const isSameOriginRequest = (request: Request): boolean => {
  const origin = request.headers.get("Origin")
  return !origin || origin === new URL(request.url).origin
}

const failure = (
  status: AuthenticationIntakeFailure["status"],
  error: AuthenticationIntakeFailure["error"],
  observability: AuthenticationIntakeObservability = {}
): AuthenticationIntakeFailure => ({
  kind: "failure",
  status,
  error,
  observability,
})

const invalidRequest = (message = "Send a valid request.") =>
  failure(400, { code: "invalid_request", error: message, retryable: false })

const unavailable = (
  message: string,
  observability: AuthenticationIntakeObservability
) =>
  failure(
    503,
    { code: "service_unavailable", error: message, retryable: true },
    observability
  )

const readJson = async (request: Request): Promise<unknown> => {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

const rateLimitFailure = (
  result: "limited" | "unavailable"
): AuthenticationIntakeFailure =>
  result === "limited"
    ? failure(
        429,
        {
          code: "rate_limited",
          error: "Too many attempts. Try again later.",
          retryable: true,
        },
        { rate_limit: { allowed: false } }
      )
    : unavailable("Login is unavailable. Try again later.", {
        configuration_error: "auth_rate_limiter_unavailable",
      })

export const createAuthenticationIntake = (
  dependencies: AuthenticationIntakeDependencies
): AuthenticationIntake => ({
  preflight: async (request) => {
    if (!isSameOriginRequest(request)) {
      return failure(403, {
        code: "forbidden",
        error: "You do not have access to this request.",
        retryable: false,
      })
    }
    const parsed = authPreflightRequestSchema.safeParse(await readJson(request))
    if (!parsed.success) {
      return invalidRequest()
    }
    const { flow, turnstileToken } = parsed.data
    const username = parsed.data.username ?? ""
    const normalizedUsername = normalizeUsername(username)
    const usernameError = validateUsername(username)
    if ((flow !== "signUp" && flow !== "signIn") || usernameError) {
      return invalidRequest(usernameError ?? "Start login again.")
    }
    const rateLimitResult = await dependencies.rateLimit({
      key:
        flow === "signUp"
          ? `auth:signup:${dependencies.clientIp(request)}`
          : `auth:signin:${dependencies.clientIp(request)}:${normalizedUsername}`,
      limit:
        flow === "signUp" ? AUTH_SIGN_UP_RATE_LIMIT : AUTH_SIGN_IN_RATE_LIMIT,
      windowSeconds: AUTH_PREFLIGHT_RATE_WINDOW_SECONDS,
    })
    if (rateLimitResult !== "allowed") {
      return rateLimitFailure(rateLimitResult)
    }
    const turnstileVerified = await dependencies.verifyTurnstile(
      request,
      turnstileToken,
      flow === "signUp" ? "lynvo-sign-up" : "lynvo-sign-in"
    )
    if (!turnstileVerified) {
      return failure(
        400,
        {
          code: "security_check_required",
          error: "Complete the security check.",
          retryable: true,
        },
        { auth_flow: flow, turnstile: { verified: false } }
      )
    }
    if (!dependencies.gatewaySecret) {
      return unavailable("Login is unavailable. Try again later.", {
        auth_flow: flow,
        configuration_error: "missing_auth_gateway_secret",
      })
    }
    const preflightToken = await signAuthPreflightToken(
      {
        flow,
        normalizedUsername,
        exp: dependencies.now() + AUTH_PREFLIGHT_TTL_MS,
      },
      dependencies.gatewaySecret
    )
    return {
      kind: "success",
      body: { preflightToken },
      observability: {
        auth_flow: flow,
        rate_limit: { allowed: true },
        turnstile: { verified: true },
      },
    }
  },
  createDeviceCode: async (request) => {
    if (!isSameOriginRequest(request)) {
      return failure(403, {
        code: "forbidden",
        error: "You do not have access to this request.",
        retryable: false,
      })
    }
    const parsed = deviceCodeRequestSchema.safeParse(await readJson(request))
    if (!parsed.success) {
      return invalidRequest()
    }
    const rateLimitResult = await dependencies.rateLimit({
      key: `auth:device-code:${dependencies.clientIp(request)}`,
      limit: DEVICE_CODE_CREATION_RATE_LIMIT,
      windowSeconds: DEVICE_CODE_CREATION_RATE_WINDOW_SECONDS,
    })
    if (rateLimitResult !== "allowed") {
      return rateLimitFailure(rateLimitResult)
    }
    if (!dependencies.gatewaySecret) {
      return unavailable("Login is unavailable. Try again later.", {
        configuration_error: "missing_auth_gateway_secret",
      })
    }
    try {
      const preflightToken = await signAuthPreflightToken(
        {
          purpose: "deviceCode",
          exp: dependencies.now() + DEVICE_CODE_PREFLIGHT_TTL_MS,
        },
        dependencies.gatewaySecret
      )
      const body = await dependencies.generateDeviceCode(
        parsed.data.deviceName ?? "Unknown device",
        preflightToken
      )
      return {
        kind: "success",
        body,
        observability: { rate_limit: { allowed: true } },
      }
    } catch (error) {
      return unavailable(
        "Device login is temporarily unavailable. Try again later.",
        {
          error: {
            type: error instanceof Error ? error.name : "UnknownError",
            message: error instanceof Error ? error.message : String(error),
          },
        }
      )
    }
  },
})

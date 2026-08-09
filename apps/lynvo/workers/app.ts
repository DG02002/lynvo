import { Hono, type Context as HonoContext } from "hono"
import { initLogger } from "evlog"
import { DurableObject } from "cloudflare:workers"
import { createRequestHandler, RouterContextProvider } from "react-router"
import { Context, Effect } from "effect"
import { AuthSessionService } from "../app/lib/effect/services/AuthSessionService"
import { CloudflareEnv } from "../app/lib/effect/services/CloudflareEnv"
import { ConvexService } from "../app/lib/effect/services/ConvexService"
import { ExtractionService } from "../app/lib/effect/services/extraction-service"
import { PluginCredentialVault } from "../app/lib/effect/services/plugin-credential-vault"
import { getRuntime } from "../app/lib/effect/runtime"
import { RequestEventService } from "../app/lib/effect/services/request-event-service"
import { handler as apiHandler } from "../app/lib/effect/api/Server"
import { signAuthPreflightToken } from "../app/lib/auth-gateway"
import { classifyAuthSignInError } from "../app/lib/auth-errors"
import { createApiErrorResponse } from "../app/lib/api-errors"
import { WORKER_SESSION_COOKIE_NAME } from "../app/lib/constants"
import { getCookieValue } from "../app/lib/auth-cookie"
import { createAuthSessionModule } from "./auth-session"
import { createSignedInSessionLifecycle } from "./signed-in-session-lifecycle"
import { createWorkerAuthenticationFlow } from "./authentication-flow"
import { normalizeUsername, validateUsername } from "../app/lib/auth-policy"
import {
  authPreflightRequestSchema,
  authSignInRequestSchema,
  deviceCodeRequestSchema,
  turnstileVerificationResponseSchema,
} from "../app/lib/auth-gateway-schemas"
import { cloudflareContext } from "../app/lib/router-context"
import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api"
import {
  DEVICE_CODE_CREATION_RATE_LIMIT,
  DEVICE_CODE_CREATION_RATE_WINDOW_SECONDS,
  DEVICE_CODE_PREFLIGHT_TTL_MS,
  EXTRACTION_ROUTE_RATE_LIMIT,
  EXTRACTION_ROUTE_RATE_WINDOW_SECONDS,
} from "../convex/constants"
import {
  addRequestContext,
  requestLogging,
  type RequestLoggingEnvironment,
} from "./request-logging"
import { responseSecurityHeaders } from "./response-security-headers"
export { AuthRateLimiter } from "./auth-rate-limiter"
export { PluginServerCredentialVault } from "./plugin-server-credential-vault"
export { WorkerAuthSession } from "./worker-auth-session"

const reactRouterHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
)

initLogger({
  env: { service: "lynvo" },
})

const app = new Hono<RequestLoggingEnvironment>()

const TURNSTILE_HOSTNAME = "lynvo.dg02002.workers.dev"
const TURNSTILE_SITEVERIFY_TIMEOUT_MS = 5_000
app.use("*", responseSecurityHeaders())

app.use("/api/*", requestLogging())

type AuthEnv = Env & {
  readonly AUTH_GATEWAY_SECRET?: string
  readonly AUTH_RATE_LIMITER?: DurableObjectNamespace
  readonly TURNSTILE_SECRET_KEY?: string
}

const requestApiError = (
  context: HonoContext<RequestLoggingEnvironment>,
  error: Parameters<typeof createApiErrorResponse>[0]
) =>
  createApiErrorResponse({
    ...error,
    requestId: context.get("requestId"),
  })

const isSameOriginRequest = (request: Request): boolean => {
  const origin = request.headers.get("Origin")
  return !origin || origin === new URL(request.url).origin
}

const getSession = (request: Request, env: Env) =>
  getRuntime(env).runPromise(
    Effect.flatMap(AuthSessionService, (authSession) =>
      authSession.getSession(request)
    )
  )

const clientIp = (request: Request): string =>
  request.headers.get("CF-Connecting-IP") ??
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  "unknown"

const rateLimit = async (
  env: AuthEnv,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<"allowed" | "limited" | "unavailable"> => {
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

const verifyTurnstile = async (
  env: AuthEnv,
  request: Request,
  token: string | undefined,
  expectedAction: "lynvo-sign-in" | "lynvo-sign-up"
): Promise<boolean> => {
  if (import.meta.env.DEV && token === "dev-token") {
    return true
  }
  if (!token || !env.TURNSTILE_SECRET_KEY) {
    return false
  }
  const form = new FormData()
  form.set("secret", env.TURNSTILE_SECRET_KEY)
  form.set("response", token)
  form.set("remoteip", clientIp(request))
  let response
  try {
    response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(TURNSTILE_SITEVERIFY_TIMEOUT_MS),
      }
    )
  } catch {
    return false
  }
  if (!response.ok) {
    return false
  }
  const result = turnstileVerificationResponseSchema.safeParse(
    await response.json()
  )
  if (
    !result.success ||
    !result.data.success ||
    result.data.action !== expectedAction
  ) {
    return false
  }
  return result.data.hostname === TURNSTILE_HOSTNAME
}

app.onError((error, context) => {
  addRequestContext(context, {
    error: {
      type: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    },
  })
  return context.json(
    { error: "Unable to process the request. Try again." },
    500
  )
})

app.get("/api/version", (context) => {
  addRequestContext(context, { operation: "version_read" })
  return context.json({ buildTime: __BUILD_TIME__ })
})

app.post("/api/auth/preflight", async (context) => {
  addRequestContext(context, { operation: "auth_preflight" })
  if (!isSameOriginRequest(context.req.raw)) {
    return context.json(
      requestApiError(context, {
        code: "forbidden",
        error: "You do not have access to this request.",
        retryable: false,
      }),
      403
    )
  }
  const env = context.env as AuthEnv
  let payload
  try {
    const result = authPreflightRequestSchema.safeParse(
      await context.req.json()
    )
    if (!result.success) {
      return context.json(
        requestApiError(context, {
          code: "invalid_request",
          error: "Send a valid request.",
          retryable: false,
        }),
        400
      )
    }
    payload = result.data
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
  const flow = payload.flow
  addRequestContext(context, { auth_flow: flow })
  const username = payload.username ?? ""
  const normalizedUsername = normalizeUsername(username)
  const usernameError = validateUsername(username)
  if ((flow !== "signUp" && flow !== "signIn") || usernameError) {
    return context.json(
      requestApiError(context, {
        code: "invalid_request",
        error: usernameError ?? "Start login again.",
        retryable: false,
      }),
      400
    )
  }
  const ip = clientIp(context.req.raw)
  const rateKey =
    flow === "signUp"
      ? `auth:signup:${ip}`
      : `auth:signin:${ip}:${normalizedUsername}`
  const rateLimitResult = await rateLimit(
    env,
    rateKey,
    flow === "signUp" ? 5 : 10,
    600
  )
  if (rateLimitResult === "unavailable") {
    addRequestContext(context, {
      configuration_error: "auth_rate_limiter_unavailable",
    })
    return context.json(
      requestApiError(context, {
        code: "service_unavailable",
        error: "Login is unavailable. Try again later.",
        retryable: true,
      }),
      503
    )
  }
  if (rateLimitResult === "limited") {
    addRequestContext(context, { rate_limit: { allowed: false } })
    return context.json(
      requestApiError(context, {
        code: "rate_limited",
        error: "Too many attempts. Try again later.",
        retryable: true,
      }),
      429
    )
  }
  const turnstileOk = await verifyTurnstile(
    env,
    context.req.raw,
    payload.turnstileToken,
    flow === "signUp" ? "lynvo-sign-up" : "lynvo-sign-in"
  )
  if (!turnstileOk) {
    addRequestContext(context, { turnstile: { verified: false } })
    return context.json(
      requestApiError(context, {
        code: "security_check_required",
        error: "Complete the security check.",
        retryable: true,
      }),
      400
    )
  }
  if (!env.AUTH_GATEWAY_SECRET) {
    addRequestContext(context, {
      configuration_error: "missing_auth_gateway_secret",
    })
    return context.json(
      requestApiError(context, {
        code: "service_unavailable",
        error: "Login is unavailable. Try again later.",
        retryable: true,
      }),
      503
    )
  }
  const preflightToken = await signAuthPreflightToken(
    {
      flow,
      normalizedUsername,
      exp: Date.now() + 2 * 60 * 1000,
    },
    env.AUTH_GATEWAY_SECRET
  )
  addRequestContext(context, {
    rate_limit: { allowed: true },
    turnstile: { verified: true },
  })
  return context.json({ preflightToken })
})

app.post("/api/auth/device/code", async (context) => {
  addRequestContext(context, { operation: "device_code_create" })
  if (!isSameOriginRequest(context.req.raw)) {
    return context.json(
      requestApiError(context, {
        code: "forbidden",
        error: "You do not have access to this request.",
        retryable: false,
      }),
      403
    )
  }
  const env = context.env as AuthEnv
  let payload
  try {
    const result = deviceCodeRequestSchema.safeParse(await context.req.json())
    if (!result.success) {
      return context.json(
        requestApiError(context, {
          code: "invalid_request",
          error: "Send a valid request.",
          retryable: false,
        }),
        400
      )
    }
    payload = result.data
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
  const rateLimitResult = await rateLimit(
    env,
    `auth:device-code:${clientIp(context.req.raw)}`,
    DEVICE_CODE_CREATION_RATE_LIMIT,
    DEVICE_CODE_CREATION_RATE_WINDOW_SECONDS
  )
  if (rateLimitResult === "unavailable") {
    addRequestContext(context, {
      configuration_error: "auth_rate_limiter_unavailable",
    })
    return context.json(
      requestApiError(context, {
        code: "service_unavailable",
        error: "Login is unavailable. Try again later.",
        retryable: true,
      }),
      503
    )
  }
  if (rateLimitResult === "limited") {
    addRequestContext(context, { rate_limit: { allowed: false } })
    return context.json(
      requestApiError(context, {
        code: "rate_limited",
        error: "Too many attempts. Try again later.",
        retryable: true,
      }),
      429
    )
  }
  if (!env.AUTH_GATEWAY_SECRET) {
    addRequestContext(context, {
      configuration_error: "missing_auth_gateway_secret",
    })
    return context.json(
      requestApiError(context, {
        code: "service_unavailable",
        error: "Login is unavailable. Try again later.",
        retryable: true,
      }),
      503
    )
  }
  try {
    const preflightToken = await signAuthPreflightToken(
      {
        purpose: "deviceCode",
        exp: Date.now() + DEVICE_CODE_PREFLIGHT_TTL_MS,
      },
      env.AUTH_GATEWAY_SECRET
    )
    const convex = new ConvexHttpClient(env.VITE_CONVEX_URL)
    const result = await convex.mutation(api.deviceAuth.generateCode, {
      deviceName: payload.deviceName ?? "Unknown device",
      preflightToken,
    })
    addRequestContext(context, { rate_limit: { allowed: true } })
    return context.json(result)
  } catch (error) {
    addRequestContext(context, {
      error: {
        type: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
      },
    })
    return context.json(
      requestApiError(context, {
        code: "service_unavailable",
        error: "Device login is temporarily unavailable. Try again later.",
        retryable: true,
      }),
      503
    )
  }
})

app.post("/api/auth/sign-in", async (context) => {
  addRequestContext(context, { operation: "auth_sign_in" })
  if (!isSameOriginRequest(context.req.raw)) {
    return context.json(
      requestApiError(context, {
        code: "forbidden",
        error: "You do not have access to this request.",
        retryable: false,
      }),
      403
    )
  }
  let payload
  try {
    const result = authSignInRequestSchema.safeParse(await context.req.json())
    if (!result.success) {
      return context.json(
        requestApiError(context, {
          code: "invalid_request",
          error: "Send a valid request.",
          retryable: false,
        }),
        400
      )
    }
    payload = result.data
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
  const flow = payload.params.flow
  try {
    const result = await createWorkerAuthenticationFlow(context.env).signIn({
      provider: payload.provider,
      params: payload.params,
    })
    if (result.kind === "unavailable") {
      return context.json(
        requestApiError(context, {
          code: "service_unavailable",
          error: "Login is unavailable. Try again later.",
          retryable: true,
        }),
        503
      )
    }
    if (result.cookie) {
      context.header("Set-Cookie", result.cookie)
    }
    addRequestContext(context, {
      auth_flow: flow,
      has_tokens: result.hasTokens,
      worker_session_created: Boolean(result.cookie),
    })
    return context.json(result.browserState)
  } catch (error) {
    const authError = classifyAuthSignInError(error, flow)
    addRequestContext(context, {
      auth_flow: flow,
      auth_error_code: authError.code,
      error: {
        type: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
      },
    })
    return context.json(
      requestApiError(context, {
        code: authError.code,
        error: authError.error,
        retryable: authError.retryable,
      }),
      authError.status
    )
  }
})

app.delete("/api/auth/session", async (context) => {
  addRequestContext(context, { operation: "auth_session_revoke" })
  if (!isSameOriginRequest(context.req.raw)) {
    return context.json(
      requestApiError(context, {
        code: "forbidden",
        error: "You do not have access to this request.",
        retryable: false,
      }),
      403
    )
  }
  const sessionId = getCookieValue(context.req.raw, WORKER_SESSION_COOKIE_NAME)
  const authSession = createAuthSessionModule(context.env.WORKER_AUTH_SESSION)
  const sessionResult = await createSignedInSessionLifecycle(
    authSession
  ).terminate({
    sessionId,
    revokeConvexSession: async (accessToken) => {
      const client = new ConvexHttpClient(context.env.VITE_CONVEX_URL)
      client.setAuth(accessToken)
      await client.mutation(api.users.revokeCurrentSessionFromWorker, {})
    },
  })
  if (sessionResult.kind === "unavailable") {
    return context.json(
      requestApiError(context, {
        code: "service_unavailable",
        error: "Logout is temporarily unavailable. Try again later.",
        retryable: true,
      }),
      503
    )
  }
  context.header("Set-Cookie", sessionResult.cookie)
  return context.body(null, 204)
})

app.get("/api/realtime", async (context) => {
  addRequestContext(context, {
    operation: "realtime_connect",
    transport: "websocket",
  })
  const request = context.req.raw
  if (request.headers.get("Upgrade") !== "websocket") {
    return context.text("Expected WebSocket", 426)
  }
  if (!isSameOriginRequest(request)) {
    return context.text("Forbidden", 403)
  }
  const session = await getSession(request, context.env)
  if (session.kind === "unavailable") {
    return context.text("Service unavailable", 503)
  }
  if (!session.user) {
    addRequestContext(context, { authenticated: false })
    return context.text("Unauthorized", 401)
  }
  addRequestContext(context, {
    authenticated: true,
    user_id: session.user.id,
  })
  return context.env.USER_REALTIME_ROOM.getByName(session.user.id).fetch(
    request
  )
})

app.use("/api/auth/device/authorize", async (context, next) => {
  const session = await getSession(context.req.raw, context.env)
  if (session.kind === "unavailable") {
    return context.text("Service unavailable", 503)
  }
  if (!session.user) {
    return next()
  }
  const rateLimitResult = await rateLimit(
    context.env,
    `auth:device-approval:${clientIp(context.req.raw)}:${session.user.id}`,
    10,
    600
  )
  if (rateLimitResult === "unavailable") {
    addRequestContext(context, {
      configuration_error: "auth_rate_limiter_unavailable",
    })
    return context.json(
      requestApiError(context, {
        code: "service_unavailable",
        error: "Device approval is unavailable. Try again later.",
        retryable: true,
      }),
      503
    )
  }
  if (rateLimitResult === "limited") {
    addRequestContext(context, { rate_limit: { allowed: false } })
    return context.json(
      requestApiError(context, {
        code: "rate_limited",
        error: "Too many attempts. Try again later.",
        retryable: true,
      }),
      429
    )
  }
  addRequestContext(context, { rate_limit: { allowed: true } })
  return next()
})

app.use("/api/extract", async (context, next) => {
  const result = await rateLimit(
    context.env,
    `extraction:${clientIp(context.req.raw)}`,
    EXTRACTION_ROUTE_RATE_LIMIT,
    EXTRACTION_ROUTE_RATE_WINDOW_SECONDS
  )
  addRequestContext(context, {
    extraction_rate_limit: { outcome: result },
  })
  if (result === "limited") {
    return context.json(
      requestApiError(context, {
        code: "rate_limited",
        error: "Too many Extraction requests. Try again later.",
        retryable: true,
      }),
      429
    )
  }
  if (result === "unavailable") {
    return context.json(
      requestApiError(context, {
        code: "service_unavailable",
        error: "Extraction is temporarily unavailable.",
        retryable: true,
      }),
      503
    )
  }
  return next()
})

app.use("/api/meta", async (context, next) => {
  const result = await rateLimit(
    context.env,
    `metadata:${clientIp(context.req.raw)}`,
    EXTRACTION_ROUTE_RATE_LIMIT,
    EXTRACTION_ROUTE_RATE_WINDOW_SECONDS
  )
  addRequestContext(context, {
    extraction_rate_limit: { outcome: result },
  })
  if (result !== "allowed") {
    return context.json(
      requestApiError(context, {
        code: result === "limited" ? "rate_limited" : "service_unavailable",
        error:
          result === "limited"
            ? "Too many metadata requests. Try again later."
            : "Metadata is temporarily unavailable.",
        retryable: true,
      }),
      result === "limited" ? 429 : 503
    )
  }
  return next()
})

app.all("/api/*", async (context) => {
  addRequestContext(context, { operation: context.req.path })
  const runtime = getRuntime(context.env)
  const services = await runtime.runPromise(
    Effect.all([
      AuthSessionService,
      ConvexService,
      ExtractionService,
      PluginCredentialVault,
    ])
  )
  const effectContext = Context.empty().pipe(
    Context.add(CloudflareEnv, context.env),
    Context.add(AuthSessionService, services[0]),
    Context.add(ConvexService, services[1]),
    Context.add(ExtractionService, services[2]),
    Context.add(PluginCredentialVault, services[3]),
    Context.add(RequestEventService, {
      requestId: context.get("requestId"),
      add: (fields) => addRequestContext(context, fields),
    })
  )
  const response = await apiHandler(context.req.raw, effectContext)
  if (
    context.req.method !== "DELETE" ||
    context.req.path !== "/api/settings/security/account" ||
    !response.ok
  ) {
    return response
  }
  const sessionId = getCookieValue(context.req.raw, WORKER_SESSION_COOKIE_NAME)
  const authSession = createAuthSessionModule(context.env.WORKER_AUTH_SESSION)
  const sessionResult = await createSignedInSessionLifecycle(
    authSession
  ).revokeWorkerSessions(sessionId ? [sessionId] : [])
  const didRevokeSession = sessionResult.kind === "completed"
  const headers = new Headers(response.headers)
  headers.set("Set-Cookie", authSession.expireCookie())
  addRequestContext(context, {
    worker_session_revoked: didRevokeSession,
  })
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
})

app.all("*", async (context) => {
  const routerContext = new RouterContextProvider()
  routerContext.set(cloudflareContext, {
    env: context.env,
    ctx: context.executionCtx,
  })
  const response = await reactRouterHandler(context.req.raw, routerContext)
  const securedResponse = new Response(response.body, response)
  securedResponse.headers.set("X-Content-Type-Options", "nosniff")
  securedResponse.headers.set("X-Frame-Options", "DENY")
  securedResponse.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  )
  securedResponse.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  )
  return securedResponse
})

const isPingMessage = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "type" in value &&
  value.type === "ping"

export class UserRealtimeRoom extends DurableObject<Env> {
  constructor(context: DurableObjectState, env: Env) {
    super(context, env)
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong")
    )
  }

  async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname.endsWith("/broadcast")) {
      const message: unknown = await request.json()
      this.broadcast(message)
      return Response.json({ success: true })
    }
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 })
    }
    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    this.ctx.acceptWebSocket(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== "string") {
      return
    }
    try {
      const parsed: unknown = JSON.parse(message)
      if (isPingMessage(parsed)) {
        socket.send(
          JSON.stringify({ type: "pong", payload: { at: Date.now() } })
        )
      }
    } catch {
      socket.close(1003, "Invalid message")
    }
  }

  webSocketClose(socket: WebSocket, code: number, reason: string): void {
    socket.close(code, reason)
  }

  webSocketError(socket: WebSocket): void {
    socket.close(1011, "WebSocket error")
  }

  private broadcast(message: unknown): void {
    const serialized = JSON.stringify(message)
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(serialized)
      } catch {
        socket.close(1011, "Broadcast failed")
      }
    }
  }
}

export default {
  fetch: (request, env, context) => app.fetch(request, env, context),
} satisfies ExportedHandler<Env>

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
import { SESSION_IDLE_TIMEOUT_MS } from "./constants"
import { normalizeUsername, validateUsername } from "../app/lib/auth-policy"
import {
  authPreflightRequestSchema,
  authSignInRequestSchema,
  deviceCodeRequestSchema,
  refreshedAuthTokensSchema,
  turnstileVerificationResponseSchema,
} from "../app/lib/auth-gateway-schemas"
import { cloudflareContext } from "../app/lib/router-context"
import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api"
import {
  DEVICE_CODE_CREATION_RATE_LIMIT,
  DEVICE_CODE_CREATION_RATE_WINDOW_SECONDS,
  DEVICE_CODE_PREFLIGHT_TTL_MS,
} from "../convex/constants"
import {
  addRequestContext,
  requestLogging,
  type RequestLoggingEnvironment,
} from "./request-logging"
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
app.use("*", async (context, next) => {
  await next()
  context.res.headers.set("Strict-Transport-Security", "max-age=31536000")
  context.res.headers.set("X-Content-Type-Options", "nosniff")
  context.res.headers.set("X-Frame-Options", "DENY")
  context.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  context.res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  )
})

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

app.post("/api/auth/tv/code", async (context) => {
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
    const result = await convex.mutation(api.tv.generateCode, {
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
    const client = new ConvexHttpClient(context.env.VITE_CONVEX_URL)
    const result = await client.action(api.auth.signIn, {
      provider: payload.provider,
      params: payload.params,
    })
    const tokens = (
      result as { tokens?: { token?: string; refreshToken?: string } }
    ).tokens
    const deviceName = payload.params.deviceName?.trim().slice(0, 80)
    if (tokens?.token && deviceName) {
      client.setAuth(tokens.token)
      await client.mutation(api.users.setCurrentSessionDevice, { deviceName })
    }
    if (tokens?.token && tokens.refreshToken) {
      const sessionId = crypto.randomUUID()
      const createdAt = Date.now()
      const sessionResult = await createAuthSessionModule(
        context.env.WORKER_AUTH_SESSION
      ).create({
        sessionId,
        accessToken: tokens.token,
        refreshToken: tokens.refreshToken,
        nowMs: createdAt,
      })
      if (sessionResult.kind === "unavailable") {
        return context.json(
          requestApiError(context, {
            code: "service_unavailable",
            error: "Login is unavailable. Try again later.",
            retryable: true,
          }),
          503
        )
      }
      context.header("Set-Cookie", sessionResult.cookie)
      addRequestContext(context, {
        auth_flow: flow,
        has_tokens: true,
        worker_session_created: true,
      })
      return context.json(result)
    }
    addRequestContext(context, {
      auth_flow: flow,
      has_tokens: Boolean(tokens),
    })
    return context.json(result)
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
  if (sessionId) {
    const sessionResult = await authSession.revoke(sessionId)
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
  } else {
    context.header("Set-Cookie", authSession.expireCookie())
  }
  return context.body(null, 204)
})

app.post("/api/auth/session/refresh", async (context) => {
  addRequestContext(context, { operation: "auth_session_refresh" })
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
  if (!sessionId) {
    return context.json(
      requestApiError(context, {
        code: "invalid_credentials",
        error: "Your session has expired.",
        retryable: false,
      }),
      401
    )
  }
  const sessionStub = context.env.WORKER_AUTH_SESSION.getByName(sessionId)
  const authSession = createAuthSessionModule(context.env.WORKER_AUTH_SESSION)
  try {
    const sessionResult = await authSession.read(sessionId)
    if (sessionResult.kind === "expired") {
      return context.json(
        requestApiError(context, {
          code: "invalid_credentials",
          error: "Your session has expired.",
          retryable: false,
        }),
        401
      )
    }
    if (sessionResult.kind === "unavailable") {
      throw new Error("Session read failed")
    }
    const session = sessionResult.session
    const client = new ConvexHttpClient(context.env.VITE_CONVEX_URL)
    const refreshed = refreshedAuthTokensSchema.parse(
      await client.action(api.auth.signIn, {
        refreshToken: session.refreshToken,
      })
    )
    if (!refreshed.tokens) {
      throw new Error("Session refresh returned no tokens")
    }
    const replaceResponse = await sessionStub.fetch(
      "https://session.internal/session",
      {
        method: "POST",
        body: JSON.stringify({
          accessToken: refreshed.tokens.token,
          refreshToken: refreshed.tokens.refreshToken,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          idleTimeoutMs: SESSION_IDLE_TIMEOUT_MS,
        }),
      }
    )
    if (!replaceResponse.ok) {
      throw new Error("Session token replacement failed")
    }
    return context.body(null, 204)
  } catch {
    return context.json(
      requestApiError(context, {
        code: "service_unavailable",
        error: "Session refresh is unavailable. Try again later.",
        retryable: true,
      }),
      503
    )
  }
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

app.use("/api/auth/tv/authorize", async (context, next) => {
  const session = await getSession(context.req.raw, context.env)
  if (!session.user) {
    return next()
  }
  const rateLimitResult = await rateLimit(
    context.env,
    `auth:tv-approval:${clientIp(context.req.raw)}:${session.user.id}`,
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
  return apiHandler(context.req.raw, effectContext)
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

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
import { createApiErrorResponse } from "../app/lib/api-errors"
import {
  REALTIME_SESSION_REVOKED_CLOSE_CODE,
  WORKER_SESSION_COOKIE_NAME,
} from "../app/lib/constants"
import { getCookieValue } from "../app/lib/auth-cookie"
import { createAuthSessionModule } from "./auth-session"
import { createSignedInSessionLifecycle } from "./signed-in-session-lifecycle"
import { createWorkerAuthenticationFlow } from "./authentication-flow"
import {
  authSignInRequestSchema,
  turnstileVerificationResponseSchema,
} from "../app/lib/auth-gateway-schemas"
import { cloudflareContext } from "../app/lib/router-context"
import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api"
import {
  EXTRACTION_ROUTE_RATE_LIMIT,
  EXTRACTION_ROUTE_RATE_WINDOW_SECONDS,
} from "../convex/constants"
import {
  addRequestContext,
  requestLogging,
  type RequestLoggingEnvironment,
} from "./request-logging"
import { responseSecurityHeaders } from "./response-security-headers"
import { buildReleaseIdentity } from "./release-identity"
import { createAuthenticationIntake } from "./authentication-intake"
import {
  checkAuthenticationRateLimit,
  checkRateLimit,
} from "./authentication-rate-limit"
import { createSessionCleanupModule } from "./session-cleanup"
import { createDurableRealtimeSessionRevocation } from "./realtime-session-revocation"
import { createRemoteCommandNotificationDelivery } from "./remote-command-notification-delivery"
import {
  CONVEX_ACCESS_TOKEN_RATE_LIMIT,
  CONVEX_ACCESS_TOKEN_RATE_WINDOW_SECONDS,
  REALTIME_SESSION_REVALIDATION_INTERVAL_MS,
} from "./constants"
import { createConvexAccessTokenHandler } from "./convex-access-token"
import { createRemoteTargetId } from "../app/lib/remote-target"
import { z } from "zod"
export { AuthRateLimiter } from "./auth-rate-limiter"
export { PluginServerCredentialVault } from "./plugin-server-credential-vault"
export { WorkerAuthSession } from "./worker-auth-session"

const reactRouterHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
)

initLogger({
  env: { service: "lynvo" },
  sampling: {
    rates: { info: 10, warn: 100, error: 100 },
    keep: [{ status: 400 }],
  },
})

const app = new Hono<RequestLoggingEnvironment>()

const TURNSTILE_HOSTNAME = "lynvo.dg02002.workers.dev"
const TURNSTILE_SITEVERIFY_TIMEOUT_MS = 5_000
app.use("*", responseSecurityHeaders())

app.use("/api/*", requestLogging({ exclude: ["/api/version"] }))

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

const rateLimit = checkRateLimit

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

const runAuthenticationIntake = async (
  context: HonoContext<RequestLoggingEnvironment>,
  operation: "preflight" | "createDeviceCode"
) => {
  // SAFETY: Hono supplies the configured Cloudflare bindings through context.env.
  const env = context.env as AuthEnv
  const intake = createAuthenticationIntake({
    gatewaySecret: env.AUTH_GATEWAY_SECRET,
    now: Date.now,
    clientIp,
    rateLimit: ({ key, limit, windowSeconds }) =>
      checkAuthenticationRateLimit(env, key, limit, windowSeconds),
    verifyTurnstile: (request, token, expectedAction) =>
      verifyTurnstile(env, request, token, expectedAction),
    generateDeviceCode: async (deviceName, preflightToken) => {
      const convex = new ConvexHttpClient(env.VITE_CONVEX_URL)
      return await convex.mutation(api.deviceAuth.generateCode, {
        deviceName,
        preflightToken,
      })
    },
  })
  const outcome = await intake[operation](context.req.raw)
  addRequestContext(context, {
    ...outcome.observability,
    authentication_outcome:
      outcome.kind === "success" ? "accepted" : outcome.error.code,
  })
  return outcome.kind === "success"
    ? context.json(outcome.body)
    : context.json(requestApiError(context, outcome.error), outcome.status)
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
  return context.json(buildReleaseIdentity(context.env, __BUILD_TIME__))
})

app.post("/api/auth/preflight", async (context) => {
  addRequestContext(context, { operation: "auth_preflight" })
  return await runAuthenticationIntake(context, "preflight")
})

app.post("/api/auth/device/code", async (context) => {
  addRequestContext(context, { operation: "device_code_create" })
  return await runAuthenticationIntake(context, "createDeviceCode")
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
      addRequestContext(context, {
        auth_flow: flow,
        authentication_outcome: "unavailable",
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
    if (result.kind === "invalid-credentials") {
      addRequestContext(context, {
        auth_flow: flow,
        authentication_outcome: "invalid_credentials",
      })
      return context.json(
        requestApiError(context, {
          code: "invalid_credentials",
          error:
            "The username or password is incorrect. Check both fields, then try again.",
          retryable: false,
        }),
        401
      )
    }
    if (result.kind === "account-exists") {
      addRequestContext(context, {
        auth_flow: flow,
        authentication_outcome: "account_exists",
      })
      return context.json(
        requestApiError(context, {
          code: "account_exists",
          error: "An account with this username already exists.",
          retryable: false,
        }),
        409
      )
    }
    if (result.cookie) {
      context.header("Set-Cookie", result.cookie)
    }
    addRequestContext(context, {
      auth_flow: flow,
      authentication_outcome: "authenticated",
      has_tokens: result.hasTokens,
      worker_session_created: Boolean(result.cookie),
    })
    return context.json(result.browserState)
  } catch (error) {
    addRequestContext(context, {
      auth_flow: flow,
      authentication_outcome: "unavailable",
      auth_error_code: "service_unavailable",
      error: {
        type: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
      },
    })
    return context.json(
      requestApiError(context, {
        code: "service_unavailable",
        error:
          flow === "signUp"
            ? "Account creation is temporarily unavailable. Try again later."
            : "Login is temporarily unavailable. Try again later.",
        retryable: true,
      }),
      503
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
  const authenticatedSession = await getSession(context.req.raw, context.env)
  if (authenticatedSession.kind === "unavailable") {
    return context.json(
      requestApiError(context, {
        code: "service_unavailable",
        error: "Logout is temporarily unavailable. Try again later.",
        retryable: true,
      }),
      503
    )
  }
  if (
    authenticatedSession.user &&
    (context.req.header("X-Lynvo-Expected-User-Id") !==
      authenticatedSession.user.id ||
      context.req.header("X-Lynvo-Expected-Session-Id") !==
        authenticatedSession.user.sid)
  ) {
    return context.text("Session identity changed", 409)
  }
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
  if (authenticatedSession.user) {
    await createDurableRealtimeSessionRevocation(context.env).deliver({
      userId: authenticatedSession.user.id,
      sessionId: authenticatedSession.user.sid,
    })
  }
  context.header("Set-Cookie", sessionResult.cookie)
  return context.body(null, 204)
})

app.get("/api/auth/session/status", async (context) => {
  addRequestContext(context, { operation: "auth_session_status" })
  const session = await getSession(context.req.raw, context.env)
  if (session.kind === "unavailable") {
    return context.json({ status: "unavailable" }, 503)
  }
  if (!session.user) {
    return context.json({ status: "unauthenticated" })
  }
  const expectedUserId = context.req.query("expectedUserId")
  const expectedSessionId = context.req.query("expectedSessionId")
  if (
    expectedUserId !== session.user.id ||
    expectedSessionId !== session.user.sid
  ) {
    return context.text("Session identity changed", 409)
  }
  return context.json({
    status: "authenticated",
    userId: session.user.id,
    sessionId: session.user.sid,
  })
})

app.post("/api/auth/convex-token", async (context) => {
  addRequestContext(context, { operation: "convex_access_token_issue" })
  const handler = createConvexAccessTokenHandler({
    checkRateLimit: (request) =>
      checkAuthenticationRateLimit(
        context.env,
        `auth:convex-token:${clientIp(request)}`,
        CONVEX_ACCESS_TOKEN_RATE_LIMIT,
        CONVEX_ACCESS_TOKEN_RATE_WINDOW_SECONDS
      ),
    resolveAccessToken: async (request, forceRefresh) => {
      const session = await getSession(request, context.env)
      if (session.kind === "unavailable") {
        addRequestContext(context, { token_issuance_outcome: "unavailable" })
        return { kind: "unavailable" }
      }
      if (!session.user || !session.accessToken) {
        addRequestContext(context, {
          token_issuance_outcome: "unauthenticated",
        })
        return { kind: "unauthenticated" }
      }
      if (!forceRefresh) {
        addRequestContext(context, {
          token_issuance_outcome: "issued",
          user_id: session.user.id,
        })
        return { kind: "authenticated", accessToken: session.accessToken }
      }

      const opaqueSessionId = getCookieValue(
        request,
        WORKER_SESSION_COOKIE_NAME
      )
      if (!opaqueSessionId) {
        return { kind: "unauthenticated" }
      }
      const authSession = createAuthSessionModule(
        context.env.WORKER_AUTH_SESSION
      )
      const rotation = await authSession.rotate({
        sessionId: opaqueSessionId,
        refresh: async (refreshToken) => {
          const client = new ConvexHttpClient(context.env.VITE_CONVEX_URL)
          const refreshed = await client.action(api.auth.signIn, {
            refreshToken,
          })
          return refreshed.tokens
            ? {
                accessToken: refreshed.tokens.token,
                refreshToken: refreshed.tokens.refreshToken,
              }
            : undefined
        },
      })
      if (rotation.kind !== "rotated") {
        addRequestContext(context, {
          token_issuance_outcome:
            rotation.kind === "unavailable" ? "unavailable" : "revoked",
        })
        return rotation.kind === "unavailable"
          ? { kind: "unavailable" }
          : { kind: "unauthenticated" }
      }
      const rotatedSession = await authSession.read(opaqueSessionId)
      if (rotatedSession.kind !== "active") {
        return rotatedSession.kind === "unavailable"
          ? { kind: "unavailable" }
          : { kind: "unauthenticated" }
      }
      addRequestContext(context, {
        token_issuance_outcome: "rotated",
        user_id: session.user.id,
      })
      return {
        kind: "authenticated",
        accessToken: rotatedSession.session.accessToken,
      }
    },
  })
  return await handler(context.req.raw)
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
  if (
    context.req.query("expectedUserId") !== session.user.id ||
    context.req.query("expectedSessionId") !== session.user.sid
  ) {
    return context.text("Session identity changed", 409)
  }
  addRequestContext(context, {
    authenticated: true,
    user_id: session.user.id,
  })
  const headers = new Headers(request.headers)
  headers.set("X-Lynvo-Session-Id", session.user.sid)
  headers.set("X-Lynvo-User-Id", session.user.id)
  const workerSessionId = getCookieValue(request, WORKER_SESSION_COOKIE_NAME)
  if (workerSessionId) {
    headers.set("X-Lynvo-Worker-Session-Id", workerSessionId)
  }
  const receiverId = context.req.query("receiverId")
  const deviceName = context.req.query("deviceName")
  if (receiverId) {
    headers.set("X-Lynvo-Receiver-Id", receiverId)
    headers.set("X-Lynvo-Receiver-Name", deviceName || "Unnamed device")
  }
  return context.env.USER_REALTIME_ROOM.getByName(session.user.id).fetch(
    new Request(request, { headers })
  )
})

app.get("/api/remote/receivers", async (context) => {
  const session = await getSession(context.req.raw, context.env)
  if (session.kind === "unavailable") {
    return context.json({ receivers: [] }, 503)
  }
  if (!session.user) {
    return context.json({ receivers: [] }, 401)
  }
  if (
    context.req.query("expectedUserId") !== session.user.id ||
    context.req.query("expectedSessionId") !== session.user.sid
  ) {
    return context.json({ receivers: [] }, 409)
  }
  const response = await context.env.USER_REALTIME_ROOM.getByName(
    session.user.id
  ).fetch("https://realtime.internal/receivers")
  return new Response(response.body, response)
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
  const authSession = createAuthSessionModule(context.env.WORKER_AUTH_SESSION)
  const headers = new Headers(response.headers)
  headers.set("Set-Cookie", authSession.expireCookie())
  addRequestContext(context, {
    worker_session_revoked: true,
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

const pingMessageSchema = z.object({ type: z.literal("ping") })
const receiverNotificationSchema = z.object({ receiverId: z.string() })
const sessionRevocationSchema = z.object({ sessionId: z.string() })
const receiverAttachmentSchema = z.object({
  receiverId: z.string(),
  sessionId: z.string(),
  deviceName: z.string(),
  connectedAt: z.number(),
})
const workerSessionAttachmentSchema = z.object({ workerSessionId: z.string() })

const isPingMessage = <Value>(value: Value): boolean =>
  pingMessageSchema.safeParse(value).success

export class UserRealtimeRoom extends DurableObject<Env> {
  constructor(context: DurableObjectState, env: Env) {
    super(context, env)
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong")
    )
  }

  async fetch(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname
    if (pathname.endsWith("/notify-inbox")) {
      const input = receiverNotificationSchema.safeParse(await request.json())
      if (!input.success) {
        return new Response("Invalid receiver", { status: 400 })
      }
      const serialized = JSON.stringify({
        type: "remote-inbox.changed",
        payload: {},
      })
      const sockets = this.ctx.getWebSockets(input.data.receiverId)
      for (const socket of sockets) {
        socket.send(serialized)
      }
      return Response.json({ deliveredSocketCount: sockets.length })
    }
    if (pathname.endsWith("/revoke-session")) {
      const input = sessionRevocationSchema.safeParse(await request.json())
      if (!input.success) {
        return new Response("Invalid session", { status: 400 })
      }
      for (const socket of this.ctx.getWebSockets(input.data.sessionId)) {
        socket.close(REALTIME_SESSION_REVOKED_CLOSE_CODE, "Session revoked")
      }
      return Response.json({ success: true })
    }
    if (pathname.endsWith("/revoke-account")) {
      for (const socket of this.ctx.getWebSockets()) {
        socket.close(
          REALTIME_SESSION_REVOKED_CLOSE_CODE,
          "Account sessions revoked"
        )
      }
      return Response.json({ success: true })
    }
    if (pathname.endsWith("/receivers")) {
      const receivers = this.ctx.getWebSockets().flatMap((socket) => {
        const attachment = receiverAttachmentSchema.safeParse(
          socket.deserializeAttachment()
        )
        if (!attachment.success) {
          return []
        }
        return [
          {
            id: createRemoteTargetId(
              attachment.data.sessionId,
              attachment.data.receiverId
            ),
            receiverId: attachment.data.receiverId,
            deviceName: attachment.data.deviceName,
            lastActiveAt: attachment.data.connectedAt,
          },
        ]
      })
      return Response.json({ receivers })
    }
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 })
    }
    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    const sessionId = request.headers.get("X-Lynvo-Session-Id")
    const userId = request.headers.get("X-Lynvo-User-Id")
    const workerSessionId = request.headers.get("X-Lynvo-Worker-Session-Id")
    const receiverId = request.headers.get("X-Lynvo-Receiver-Id")
    const deviceName = request.headers.get("X-Lynvo-Receiver-Name")
    if (
      !sessionId ||
      !workerSessionId ||
      !userId ||
      !receiverId ||
      !deviceName
    ) {
      return new Response("Missing session", { status: 401 })
    }
    for (const existingSocket of this.ctx.getWebSockets(receiverId)) {
      existingSocket.close(1000, "Receiver replaced")
    }
    server.serializeAttachment({
      sessionId,
      workerSessionId,
      receiverId,
      deviceName,
      connectedAt: Date.now(),
    })
    this.ctx.acceptWebSocket(server, [sessionId, receiverId])
    server.send(JSON.stringify({ type: "session_hello", userId, sessionId }))
    const nextAlarmAt = Date.now() + REALTIME_SESSION_REVALIDATION_INTERVAL_MS
    const existingAlarmAt = await this.ctx.storage.getAlarm()
    if (existingAlarmAt === null || existingAlarmAt > nextAlarmAt) {
      await this.ctx.storage.setAlarm(nextAlarmAt)
    }
    return new Response(null, { status: 101, webSocket: client })
  }

  async alarm(): Promise<void> {
    try {
      await Promise.all(
        this.ctx.getWebSockets().map(async (socket) => {
          try {
            const attachment = workerSessionAttachmentSchema.safeParse(
              socket.deserializeAttachment()
            )
            if (!attachment.success) {
              socket.close(
                REALTIME_SESSION_REVOKED_CLOSE_CODE,
                "Session invalid"
              )
              return
            }
            const response = await this.env.WORKER_AUTH_SESSION.getByName(
              attachment.data.workerSessionId
            ).fetch("https://session.internal/session", { method: "HEAD" })
            if (response.status === 401 || response.status === 404) {
              socket.close(
                REALTIME_SESSION_REVOKED_CLOSE_CODE,
                "Session expired"
              )
            }
          } catch {
            return
          }
        })
      )
    } finally {
      if (this.ctx.getWebSockets().length > 0) {
        await this.ctx.storage.setAlarm(
          Date.now() + REALTIME_SESSION_REVALIDATION_INTERVAL_MS
        )
      }
    }
  }

  async webSocketMessage(
    socket: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    const textMessage = z.string().safeParse(message)
    if (!textMessage.success) {
      return
    }
    try {
      const parsed = JSON.parse(textMessage.data)
      if (isPingMessage(parsed)) {
        socket.send(
          JSON.stringify({ type: "pong", payload: { at: Date.now() } })
        )
        return
      }
      socket.close(1003, "Unsupported message")
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
}

export default {
  fetch: (request, env, context) => app.fetch(request, env, context),
  scheduled: async (_controller, env) => {
    const startedAt = performance.now()
    const [
      sessionCleanupResult,
      realtimeRevocationResult,
      remoteCommandNotificationResult,
    ] = await Promise.all([
      createSessionCleanupModule(env).drain(),
      createDurableRealtimeSessionRevocation(env).drain(),
      createRemoteCommandNotificationDelivery(env).drain(),
    ])
    const unavailable = [
      sessionCleanupResult,
      realtimeRevocationResult,
      remoteCommandNotificationResult,
    ].filter((result) => result.kind === "unavailable").length
    console.info("scheduled_delivery_drain", {
      operation: "scheduled_delivery_drain",
      outcome: unavailable > 0 ? "failure" : "success",
      unavailable,
      duration_ms: Math.max(0, performance.now() - startedAt),
    })
    if (
      sessionCleanupResult.kind === "unavailable" ||
      realtimeRevocationResult.kind === "unavailable" ||
      remoteCommandNotificationResult.kind === "unavailable"
    ) {
      throw new Error("Worker Auth Session cleanup is unavailable")
    }
  },
} satisfies ExportedHandler<Env>

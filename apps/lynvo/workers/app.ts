import { Context, Effect } from "effect"
import { initLogger } from "evlog"
import { Hono, type MiddlewareHandler } from "hono"
import { createRequestHandler, RouterContextProvider } from "react-router"

import { handler as apiHandler } from "../app/lib/effect/api/server"
import { getRuntime } from "../app/lib/effect/runtime"
import { CloudflareEnv } from "../app/lib/effect/services/cloudflare-env"
import { ExtractionService } from "../app/lib/effect/services/extraction-service"
import { PluginCredentialVault } from "../app/lib/effect/services/plugin-credential-vault"
import { RequestEventService } from "../app/lib/effect/services/request-event-service"
import { cloudflareContext } from "../app/lib/router-context"
import {
  createDeviceCodeRateLimitResponse,
  readDeviceCodeRequestName,
} from "./auth/device-code"
import {
  checkAuthenticationRateLimit,
  checkDeviceApprovalRateLimit,
  checkRateLimit,
} from "./authentication-rate-limit"
import {
  DEVICE_CODE_CREATION_RATE_LIMIT,
  DEVICE_CODE_CREATION_RATE_WINDOW_SECONDS,
  EFFECT_MUTATION_ROUTE_RATE_LIMIT,
  EFFECT_MUTATION_ROUTE_RATE_WINDOW_SECONDS,
  EXTRACTION_ROUTE_RATE_LIMIT,
  EXTRACTION_ROUTE_RATE_WINDOW_SECONDS,
  MAX_INBOUND_API_BODY_BYTES,
} from "./constants"
import { scheduled } from "./cron"
import { registerD1AuthRoutes } from "./d1/auth-routes"
import { registerD1DataRoutes } from "./d1/data-routes"
import { getD1Database } from "./d1/db"
import { createDeviceCode } from "./d1/device-auth"
import {
  expireD1SessionCookie,
  resolveSessionContext,
  revokeSessionById,
} from "./d1/sessions"
import { echoDataVersion } from "./d1/version-echo"
import { closeRealtimeSession } from "./realtime-session-revocation"
import { USER_REALTIME_ROOM_INTERNAL_URLS } from "./realtime/realtime-room-client"
import {
  buildRealtimeForwardHeaders,
  createRealtimeHandshakeRejection,
} from "./realtime/user-realtime-room"
import { buildReleaseIdentity } from "./release-identity"
import { requestApiError } from "./request-api-error"
import { getClientIp } from "./request-client-ip"
import {
  addRequestContext,
  recordRateLimitResult,
  requestLogging,
  type RequestLoggingEnvironment,
} from "./request-logging"
import {
  applyResponseSecurityHeaders,
  responseSecurityHeaders,
} from "./response-security-headers"
import { isSameOriginRequest } from "./same-origin"
export { scheduled }
export { UserRealtimeRoom } from "./realtime/user-realtime-room"
export { AuthRateLimiter } from "./auth-rate-limiter"
export { PluginServerCredentialVault } from "./plugin-server-credential-vault"

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

app.use("*", responseSecurityHeaders())

app.use("/api/*", requestLogging({ exclude: ["/api/version"] }))

const requestDeclaresOversizedApiBody = (request: Request): boolean => {
  const contentLength = request.headers.get("content-length")
  if (!contentLength || !/^\d+$/.test(contentLength)) {
    return false
  }
  const declaredLength = Number(contentLength)
  return (
    !Number.isSafeInteger(declaredLength) ||
    declaredLength > MAX_INBOUND_API_BODY_BYTES
  )
}

const API_BODY_LIMIT_EXCEEDED = Symbol("API body limit exceeded")

const requestBodyStreamExceedsApiBodyLimit = async (
  request: Request
): Promise<boolean> => {
  const { body } = request.clone()
  if (!body) {
    return false
  }
  let bytesRead = 0
  try {
    await body.pipeTo(
      new WritableStream<Uint8Array>({
        write(chunk) {
          bytesRead += chunk.byteLength
          if (bytesRead <= MAX_INBOUND_API_BODY_BYTES) {
            return
          }
          // The cloned request tees its stream, so cancel the original branch
          // while pipeTo cancels this branch after the sink rejects.
          const cancellation = request.body?.cancel()
          void cancellation?.catch((cause: unknown) => {
            console.warn("api_body_limit_cancel_failed", {
              error: cause instanceof Error ? cause.message : String(cause),
            })
          })
          throw API_BODY_LIMIT_EXCEEDED
        },
      })
    )
    return false
  } catch (cause) {
    if (cause === API_BODY_LIMIT_EXCEEDED) {
      return true
    }
    throw cause
  }
}

const requestExceedsApiBodyLimit = async (request: Request): Promise<boolean> =>
  requestDeclaresOversizedApiBody(request) ||
  (request.body !== null &&
    (await requestBodyStreamExceedsApiBodyLimit(request)))

app.use("/api/*", async (context, next) => {
  if (!(await requestExceedsApiBodyLimit(context.req.raw))) {
    return next()
  }
  return context.json(
    requestApiError(context, {
      code: "invalid_request",
      error: "Request body exceeds the configured limit.",
      retryable: false,
    }),
    413
  )
})

type AuthEnv = Env & {
  readonly AUTH_RATE_LIMITER?: DurableObjectNamespace
}

const rateLimit = checkRateLimit

const effectMutationRouteGroups = [
  { name: "settings", path: "/api/settings" },
  { name: "plugin-servers", path: "/api/plugin-servers" },
  { name: "plugin-domains", path: "/api/plugin-domains" },
  { name: "proxy", path: "/api/proxy" },
  { name: "remote", path: "/api/remote" },
] as const

const effectMutationRateLimit =
  (group: string): MiddlewareHandler<RequestLoggingEnvironment> =>
  async (context, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(context.req.method)) {
      return next()
    }

    const result = await rateLimit({
      environment: context.env,
      key: `effect-mutation:${group}:${getClientIp(context.req.raw)}`,
      limit: EFFECT_MUTATION_ROUTE_RATE_LIMIT,
      windowSeconds: EFFECT_MUTATION_ROUTE_RATE_WINDOW_SECONDS,
    })
    const retryAfterSeconds =
      result.status === "limited" && result.expiresAt !== undefined
        ? Math.max(1, Math.ceil((result.expiresAt - Date.now()) / 1_000))
        : undefined
    recordRateLimitResult(context, result, retryAfterSeconds)

    if (result.status === "limited") {
      if (retryAfterSeconds !== undefined) {
        context.header("Retry-After", String(retryAfterSeconds))
      }
      return context.json(
        requestApiError(context, {
          code: "rate_limited",
          error: "Too many requests. Try again later.",
          retryable: true,
        }),
        429
      )
    }
    if (result.status === "unavailable") {
      return context.json(
        requestApiError(context, {
          code: "service_unavailable",
          error: "This service is temporarily unavailable.",
          retryable: true,
        }),
        503
      )
    }
    return next()
  }

const resolveRequestSession = async (
  request: Request,
  env: AuthEnv
): Promise<
  | { readonly kind: "unavailable" }
  | { readonly kind: "anonymous" }
  | {
      readonly kind: "authenticated"
      readonly userId: string
      readonly sessionId: string
      readonly email: string
    }
> => {
  const database = getD1Database(env)
  if (!database) {
    return { kind: "unavailable" }
  }
  const session = await resolveSessionContext({
    request,
    database,
    now: Date.now(),
    environment: env,
  })
  if (!session) {
    return { kind: "anonymous" }
  }
  return {
    kind: "authenticated",
    userId: session.userId,
    sessionId: session.sessionId,
    email: session.email,
  }
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
  const deviceName = await readDeviceCodeRequestName(context)
  if (deviceName instanceof Response) {
    return deviceName
  }
  const rateLimitResult = await checkAuthenticationRateLimit({
    environment: context.env,
    key: `auth:device-code:${getClientIp(context.req.raw)}`,
    limit: DEVICE_CODE_CREATION_RATE_LIMIT,
    windowSeconds: DEVICE_CODE_CREATION_RATE_WINDOW_SECONDS,
  })
  const rateLimitResponse = createDeviceCodeRateLimitResponse(
    context,
    rateLimitResult
  )
  if (rateLimitResponse) {
    return rateLimitResponse
  }
  const database = getD1Database(context.env)
  if (!database) {
    return context.json(
      requestApiError(context, {
        code: "service_unavailable",
        error: "Device sign-in is unavailable. Try again later.",
        retryable: true,
      }),
      503
    )
  }
  try {
    const code = await createDeviceCode(database, {
      deviceName,
      now: Date.now(),
    })
    addRequestContext(context, { device_code_created: true })
    return context.json(code)
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
        error: "Device sign-in is temporarily unavailable. Try again later.",
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
  const session = await resolveRequestSession(context.req.raw, context.env)
  if (session.kind === "unavailable") {
    return context.json(
      requestApiError(context, {
        code: "service_unavailable",
        error: "Sign-out is temporarily unavailable. Try again later.",
        retryable: true,
      }),
      503
    )
  }
  const database = getD1Database(context.env)
  if (session.kind === "authenticated" && database) {
    if (
      context.req.header("X-Lynvo-Expected-User-Id") !== session.userId ||
      context.req.header("X-Lynvo-Expected-Session-Id") !== session.sessionId
    ) {
      return context.text("Session identity changed", 409)
    }
    await revokeSessionById(database, session.sessionId, Date.now())
    await closeRealtimeSession(context.env, session.userId, session.sessionId)
    addRequestContext(context, {
      session_revoked: true,
      user_id: session.userId,
    })
  }
  context.header("Set-Cookie", expireD1SessionCookie())
  return context.body(null, 204)
})

app.get("/api/auth/session/status", async (context) => {
  addRequestContext(context, { operation: "auth_session_status" })
  const session = await resolveRequestSession(context.req.raw, context.env)
  if (session.kind === "unavailable") {
    return context.json({ status: "unavailable" }, 503)
  }
  if (session.kind === "anonymous") {
    return context.json({ status: "unauthenticated" })
  }
  const expectedUserId = context.req.query("expectedUserId")
  const expectedSessionId = context.req.query("expectedSessionId")
  if (
    expectedUserId !== session.userId ||
    expectedSessionId !== session.sessionId
  ) {
    return context.text("Session identity changed", 409)
  }
  return context.json({
    status: "authenticated",
    userId: session.userId,
    sessionId: session.sessionId,
  })
})

app.get("/api/realtime", async (context) => {
  addRequestContext(context, {
    operation: "realtime_connect",
    transport: "websocket",
  })
  const handshakeRejection = await createRealtimeHandshakeRejection(context)
  if (handshakeRejection) {
    return handshakeRejection
  }
  const request = context.req.raw
  const session = await resolveRequestSession(request, context.env)
  if (session.kind === "unavailable") {
    return context.text("Service unavailable", 503)
  }
  if (session.kind === "anonymous") {
    addRequestContext(context, { authenticated: false })
    return context.text("Unauthorized", 401)
  }
  if (
    context.req.query("expectedUserId") !== session.userId ||
    context.req.query("expectedSessionId") !== session.sessionId
  ) {
    return context.text("Session identity changed", 409)
  }
  addRequestContext(context, {
    authenticated: true,
    user_id: session.userId,
  })
  const headers = buildRealtimeForwardHeaders({
    request,
    session,
    receiverId: context.req.query("receiverId"),
    deviceName: context.req.query("deviceName"),
  })
  return context.env.USER_REALTIME_ROOM.getByName(session.userId).fetch(
    new Request(request, { headers })
  )
})

app.get("/api/remote/receivers", async (context) => {
  const session = await resolveRequestSession(context.req.raw, context.env)
  if (session.kind === "unavailable") {
    return context.json({ receivers: [] }, 503)
  }
  if (session.kind === "anonymous") {
    return context.json({ receivers: [] }, 401)
  }
  if (
    context.req.query("expectedUserId") !== session.userId ||
    context.req.query("expectedSessionId") !== session.sessionId
  ) {
    return context.json({ receivers: [] }, 409)
  }
  const response = await context.env.USER_REALTIME_ROOM.getByName(
    session.userId
  ).fetch(USER_REALTIME_ROOM_INTERNAL_URLS.receivers)
  return new Response(response.body, response)
})

app.use("/api/auth/device/authorize", async (context, next) => {
  const session = await resolveRequestSession(context.req.raw, context.env)
  if (session.kind === "unavailable") {
    return context.text("Service unavailable", 503)
  }
  if (session.kind === "anonymous") {
    return next()
  }
  const rateLimitResult = await checkDeviceApprovalRateLimit({
    environment: context.env,
    request: context.req.raw,
    userId: session.userId,
  })
  recordRateLimitResult(context, rateLimitResult)
  if (rateLimitResult.status === "unavailable") {
    return context.json(
      requestApiError(context, {
        code: "service_unavailable",
        error: "Device approval is unavailable. Try again later.",
        retryable: true,
      }),
      503
    )
  }
  if (rateLimitResult.status === "limited") {
    return context.json(
      requestApiError(context, {
        code: "rate_limited",
        error: "Too many attempts. Try again later.",
        retryable: true,
      }),
      429
    )
  }
  return next()
})

app.use("/api/extract", async (context, next) => {
  const result = await rateLimit({
    environment: context.env,
    key: `extraction:${getClientIp(context.req.raw)}`,
    limit: EXTRACTION_ROUTE_RATE_LIMIT,
    windowSeconds: EXTRACTION_ROUTE_RATE_WINDOW_SECONDS,
  })
  addRequestContext(context, {
    extraction_rate_limit: { outcome: result.status },
  })
  if (result.status === "limited") {
    return context.json(
      requestApiError(context, {
        code: "rate_limited",
        error: "Too many Extraction requests. Try again later.",
        retryable: true,
      }),
      429
    )
  }
  if (result.status === "unavailable") {
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
  const result = await rateLimit({
    environment: context.env,
    key: `metadata:${getClientIp(context.req.raw)}`,
    limit: EXTRACTION_ROUTE_RATE_LIMIT,
    windowSeconds: EXTRACTION_ROUTE_RATE_WINDOW_SECONDS,
  })
  addRequestContext(context, {
    extraction_rate_limit: { outcome: result.status },
  })
  if (result.status !== "allowed") {
    return context.json(
      requestApiError(context, {
        code:
          result.status === "limited" ? "rate_limited" : "service_unavailable",
        error:
          result.status === "limited"
            ? "Too many metadata requests. Try again later."
            : "Metadata is temporarily unavailable.",
        retryable: true,
      }),
      result.status === "limited" ? 429 : 503
    )
  }
  return next()
})

for (const group of effectMutationRouteGroups) {
  const middleware = effectMutationRateLimit(group.name)
  app.use(group.path, middleware)
  app.use(`${group.path}/*`, middleware)
}

registerD1AuthRoutes(app)

app.use("/api/data/*", echoDataVersion())

registerD1DataRoutes(app)

app.all("/api/*", async (context) => {
  addRequestContext(context, { operation: context.req.path })
  const runtime = getRuntime(context.env)
  const services = await runtime.runPromise(
    Effect.all([ExtractionService, PluginCredentialVault])
  )
  const effectContext = Context.empty().pipe(
    Context.add(CloudflareEnv, context.env),
    Context.add(ExtractionService, services[0]),
    Context.add(PluginCredentialVault, services[1]),
    Context.add(RequestEventService, {
      requestId: context.get("requestId"),
      add: (fields) => addRequestContext(context, fields),
    })
  )
  const response = await apiHandler(context.req.raw, effectContext)
  // The account-delete Effect handler still needs this Hono edge to expire its session cookie.
  // Keep the route-string coupling beside the Effect mount until that handler owns the cookie.
  if (
    context.req.method !== "DELETE" ||
    context.req.path !== "/api/settings/security/account" ||
    !response.ok
  ) {
    return response
  }
  const headers = new Headers(response.headers)
  headers.set("Set-Cookie", expireD1SessionCookie())
  addRequestContext(context, {
    session_cookie_expired: true,
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
  applyResponseSecurityHeaders(securedResponse.headers)
  return securedResponse
})

export default {
  fetch: (request, env, context) => app.fetch(request, env, context),
  scheduled,
} satisfies ExportedHandler<Env>

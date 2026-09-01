import { Hono, type Context as HonoContext } from "hono"
import { initLogger } from "evlog"
import { DurableObject } from "cloudflare:workers"
import { createRequestHandler, RouterContextProvider } from "react-router"
import { Context, Effect, Result, Schema } from "effect"
import { CloudflareEnv } from "../app/lib/effect/services/cloudflare-env"
import { ExtractionService } from "../app/lib/effect/services/extraction-service"
import { PluginCredentialVault } from "../app/lib/effect/services/plugin-credential-vault"
import { getRuntime } from "../app/lib/effect/runtime"
import { RequestEventService } from "../app/lib/effect/services/request-event-service"
import { handler as apiHandler } from "../app/lib/effect/api/server"
import { refreshCustomPluginServerManifests } from "./plugin-server-manifest-refresh"
import { createApiErrorResponse } from "../app/lib/api-errors"
import { REALTIME_SESSION_REVOKED_CLOSE_CODE } from "../app/lib/constants"
import { deviceCodeRequestSchema } from "../app/lib/auth-gateway-schemas"
import { cloudflareContext } from "../app/lib/router-context"
import {
  addRequestContext,
  requestLogging,
  type RequestLoggingEnvironment,
} from "./request-logging"
import { responseSecurityHeaders } from "./response-security-headers"
import { buildReleaseIdentity } from "./release-identity"
import {
  checkAuthenticationRateLimit,
  checkRateLimit,
  type AuthenticationRateLimitResult,
} from "./authentication-rate-limit"
import { createRemoteCommandNotificationDelivery } from "./remote-command-notification-delivery"
import { closeRealtimeSession } from "./realtime-session-revocation"
import {
  CRON_SCHEDULE_DAILY_RETENTION,
  CRON_SCHEDULE_HOURLY_MAINTENANCE,
  DEVICE_CODE_CREATION_RATE_LIMIT,
  DEVICE_CODE_CREATION_RATE_WINDOW_SECONDS,
  EXTRACTION_ROUTE_RATE_LIMIT,
  EXTRACTION_ROUTE_RATE_WINDOW_SECONDS,
  REALTIME_SESSION_REVALIDATION_INTERVAL_MS,
} from "./constants"
import { createRemoteTargetId } from "../app/lib/remote-target"
import { isSameOriginRequest } from "./same-origin"
import { registerD1AuthRoutes } from "./d1/auth-routes"
import { registerD1DataRoutes } from "./d1/data-routes"
import { getDataVersion } from "./d1/data-version"
import { getD1Database } from "./d1/db"
import { cleanupExpiredDeviceCodes, createDeviceCode } from "./d1/device-auth"
import {
  deleteStaleSessions,
  expireD1SessionCookie,
  findActiveSessionById,
  resolveSessionContext,
  revokeSessionById,
} from "./d1/sessions"
import {
  cleanupSavedLinkCommandOperations,
  sweepExpiredLinks,
} from "./d1/links"
import { releaseExpiredManagedExtractions } from "./d1/usage"
import { cleanupExpiredRemoteCommands } from "./d1/remote-commands"
import { drainAccountErasures } from "./d1/account-erasure"
import { expireStalePluginServerRegistrations } from "./d1/plugin-servers"
import { echoDataVersion } from "./d1/version-echo"
import { processQueuedLinkExtractions } from "./link-extraction-runner"
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

const requestApiError = (
  context: HonoContext<RequestLoggingEnvironment>,
  error: Parameters<typeof createApiErrorResponse>[0]
) =>
  createApiErrorResponse({
    ...error,
    requestId: context.get("requestId"),
  })

type AuthEnv = Env & {
  readonly AUTH_RATE_LIMITER?: DurableObjectNamespace
}

const toFailureMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

const clientIp = (request: Request): string =>
  request.headers.get("CF-Connecting-IP") ??
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  "unknown"

const rateLimit = checkRateLimit

const readDeviceCodeRequestName = async (
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

const createDeviceCodeRateLimitResponse = (
  context: HonoContext<RequestLoggingEnvironment>,
  rateLimitResult: AuthenticationRateLimitResult
): Response | undefined => {
  if (rateLimitResult === "allowed") {
    return undefined
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
  addRequestContext(context, {
    configuration_error: "auth_rate_limiter_unavailable",
  })
  return context.json(
    requestApiError(context, {
      code: "service_unavailable",
      error: "Device login is unavailable. Try again later.",
      retryable: true,
    }),
    503
  )
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
  const session = await resolveSessionContext(request, database, Date.now())
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
    key: `auth:device-code:${clientIp(context.req.raw)}`,
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
        error: "Device login is unavailable. Try again later.",
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
        error: "Device login is temporarily unavailable. Try again later.",
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
        error: "Logout is temporarily unavailable. Try again later.",
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

interface RealtimeForwardHeadersInput {
  request: Request
  session: {
    readonly userId: string
    readonly sessionId: string
  }
  receiverId: string | undefined
  deviceName: string | undefined
}

const buildRealtimeForwardHeaders = ({
  request,
  session,
  receiverId,
  deviceName,
}: RealtimeForwardHeadersInput): Headers => {
  const headers = new Headers(request.headers)
  headers.set("X-Lynvo-Session-Id", session.sessionId)
  headers.set("X-Lynvo-User-Id", session.userId)
  if (receiverId) {
    headers.set("X-Lynvo-Receiver-Id", receiverId)
    headers.set("X-Lynvo-Receiver-Name", deviceName || "Unnamed device")
  }
  return headers
}

const createRealtimeHandshakeRejection = async (
  context: HonoContext<RequestLoggingEnvironment>
): Promise<Response | undefined> => {
  const request = context.req.raw
  if (request.headers.get("Upgrade") !== "websocket") {
    return context.text("Expected WebSocket", 426)
  }
  if (!isSameOriginRequest(request)) {
    return context.text("Forbidden", 403)
  }
  const handshakeRateLimit = await rateLimit({
    environment: context.env,
    key: `realtime:${clientIp(request)}`,
    limit: EXTRACTION_ROUTE_RATE_LIMIT,
    windowSeconds: EXTRACTION_ROUTE_RATE_WINDOW_SECONDS,
  })
  if (handshakeRateLimit === "limited") {
    addRequestContext(context, { rate_limit: { allowed: false } })
    return context.text("Too many connection attempts", 429)
  }
  return undefined
}

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
  ).fetch("https://realtime.internal/receivers")
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
  const rateLimitResult = await rateLimit({
    environment: context.env,
    key: `auth:device-approval:${clientIp(context.req.raw)}:${session.userId}`,
    limit: 10,
    windowSeconds: 600,
  })
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
  const result = await rateLimit({
    environment: context.env,
    key: `extraction:${clientIp(context.req.raw)}`,
    limit: EXTRACTION_ROUTE_RATE_LIMIT,
    windowSeconds: EXTRACTION_ROUTE_RATE_WINDOW_SECONDS,
  })
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
  const result = await rateLimit({
    environment: context.env,
    key: `metadata:${clientIp(context.req.raw)}`,
    limit: EXTRACTION_ROUTE_RATE_LIMIT,
    windowSeconds: EXTRACTION_ROUTE_RATE_WINDOW_SECONDS,
  })
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

const pingMessageSchema = Schema.Struct({ type: Schema.Literal("ping") })

const sweepD1AuthData = async (
  database: D1Database
): Promise<{ kind: "swept" } | { kind: "unavailable" }> => {
  try {
    const now = Date.now()
    const [deletedSessions, deletedDeviceCodes] = await Promise.all([
      deleteStaleSessions(database, now),
      cleanupExpiredDeviceCodes(database, now),
    ])
    console.info("d1_auth_sweep", {
      operation: "d1_auth_sweep",
      deleted_sessions: deletedSessions,
      deleted_device_codes: deletedDeviceCodes.deleted,
    })
    return { kind: "swept" }
  } catch (error) {
    console.error("d1_auth_sweep_failed", {
      operation: "d1_auth_sweep",
      error: error instanceof Error ? error.message : String(error),
    })
    return { kind: "unavailable" }
  }
}

type MaintenanceOutcome = { kind: "swept" } | { kind: "unavailable" }

interface D1MaintenanceSummary {
  readonly job: string
  readonly deletedCount: number
}

const sweepLinkCommandOperationsJob = async (
  database: D1Database,
  now: number
): Promise<D1MaintenanceSummary> => ({
  job: "link_command_operations_ttl",
  deletedCount: (await cleanupSavedLinkCommandOperations(database, now))
    .deleted,
})

const expirePluginServerRegistrationsJob = async (
  database: D1Database,
  now: number
): Promise<D1MaintenanceSummary> => ({
  job: "plugin_server_registration_expiry",
  deletedCount: (await expireStalePluginServerRegistrations(database, now))
    .expired,
})

const sweepRetainedLinksJob = async (
  database: D1Database,
  now: number
): Promise<D1MaintenanceSummary> => ({
  job: "links_retention",
  deletedCount: (await sweepExpiredLinks(database, now)).deletedLinks,
})

const releaseExpiredExtractionsJob = async (
  database: D1Database,
  now: number
): Promise<D1MaintenanceSummary> => ({
  job: "managed_extraction_lease_expiry",
  deletedCount: (await releaseExpiredManagedExtractions(database, now))
    .released,
})

const cleanupRemoteCommandsJob = async (
  database: D1Database,
  now: number
): Promise<D1MaintenanceSummary> => ({
  job: "remote_commands_ttl",
  deletedCount: (await cleanupExpiredRemoteCommands(database, now))
    .deletedCount,
})

const drainPendingAccountErasuresJob = async (
  database: D1Database
): Promise<MaintenanceOutcome> => {
  try {
    const outcome = await drainAccountErasures(database)
    console.info("account_erasure_drain", {
      operation: "account_erasure_drain",
      processed_users: outcome.processedUsers,
      steps_exhausted: outcome.stepsExhausted,
    })
    return { kind: "swept" }
  } catch (error) {
    console.error("account_erasure_drain_failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return { kind: "unavailable" }
  }
}

const runD1Maintenance = async (
  database: D1Database,
  maintenance: (now: number) => Promise<D1MaintenanceSummary>
): Promise<MaintenanceOutcome> => {
  try {
    const summary = await maintenance(Date.now())
    console.info("d1_maintenance", {
      operation: summary.job,
      deleted_count: summary.deletedCount,
    })
    return { kind: "swept" }
  } catch (error) {
    console.error("d1_maintenance_failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return { kind: "unavailable" }
  }
}

const runHourlyD1Maintenance = async (
  database: D1Database
): Promise<MaintenanceOutcome[]> =>
  Promise.all([
    runD1Maintenance(database, (now) =>
      expirePluginServerRegistrationsJob(database, now)
    ),
    drainPendingAccountErasuresJob(database),
  ])

const runDailyD1Maintenance = async (
  database: D1Database
): Promise<MaintenanceOutcome> =>
  runD1Maintenance(database, (now) => sweepRetainedLinksJob(database, now))

const runHighFrequencyD1Maintenance = async (
  database: D1Database
): Promise<MaintenanceOutcome[]> =>
  Promise.all([
    runD1Maintenance(database, (now) =>
      releaseExpiredExtractionsJob(database, now)
    ),
    runD1Maintenance(database, (now) =>
      cleanupRemoteCommandsJob(database, now)
    ),
    runD1Maintenance(database, (now) =>
      sweepLinkCommandOperationsJob(database, now)
    ),
  ])
const receiverNotificationSchema = Schema.Struct({ receiverId: Schema.String })
const sessionRevocationSchema = Schema.Struct({ sessionId: Schema.String })
const dataChangedSchema = Schema.Struct({
  version: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
})
const receiverAttachmentSchema = Schema.Struct({
  receiverId: Schema.String,
  sessionId: Schema.String,
  deviceName: Schema.String,
  connectedAt: Schema.Number,
})

const isPingMessage = <Value>(value: Value): boolean =>
  Result.isSuccess(Schema.decodeUnknownResult(pingMessageSchema)(value))

interface RealtimeWebSocketSession {
  sessionId: string
  userId: string
  receiverId: string
  deviceName: string
}

interface RealtimeSessionHelloPayload {
  type: "session_hello"
  userId: string
  sessionId: string
  dataVersion?: number
}

const handleRealtimeDataChanged = async (
  context: DurableObjectState,
  request: Request
): Promise<Response> => {
  const input = Schema.decodeUnknownResult(dataChangedSchema)(
    await request.json()
  )
  if (Result.isFailure(input)) {
    return new Response("Invalid data version", { status: 400 })
  }
  const serialized = JSON.stringify({
    type: "data-changed",
    payload: { version: input.success.version },
  })
  const sockets = context.getWebSockets()
  for (const socket of sockets) {
    socket.send(serialized)
  }
  return Response.json({ deliveredSocketCount: sockets.length })
}

const handleRealtimeInboxNotification = async (
  context: DurableObjectState,
  request: Request
): Promise<Response> => {
  const input = Schema.decodeUnknownResult(receiverNotificationSchema)(
    await request.json()
  )
  if (Result.isFailure(input)) {
    return new Response("Invalid receiver", { status: 400 })
  }
  const serialized = JSON.stringify({
    type: "remote-inbox.changed",
    payload: {},
  })
  const sockets = context.getWebSockets(input.success.receiverId)
  for (const socket of sockets) {
    socket.send(serialized)
  }
  return Response.json({ deliveredSocketCount: sockets.length })
}

const handleRealtimeSessionRevocation = async (
  context: DurableObjectState,
  request: Request
): Promise<Response> => {
  const input = Schema.decodeUnknownResult(sessionRevocationSchema)(
    await request.json()
  )
  if (Result.isFailure(input)) {
    return new Response("Invalid session", { status: 400 })
  }
  for (const socket of context.getWebSockets(input.success.sessionId)) {
    socket.close(REALTIME_SESSION_REVOKED_CLOSE_CODE, "Session revoked")
  }
  return Response.json({ success: true })
}

const handleRealtimeAccountRevocation = (
  context: DurableObjectState
): Response => {
  for (const socket of context.getWebSockets()) {
    socket.close(
      REALTIME_SESSION_REVOKED_CLOSE_CODE,
      "Account sessions revoked"
    )
  }
  return Response.json({ success: true })
}

const handleRealtimeReceivers = (context: DurableObjectState): Response => {
  const receivers = context.getWebSockets().flatMap((socket) => {
    const attachment = Schema.decodeUnknownResult(receiverAttachmentSchema)(
      socket.deserializeAttachment()
    )
    if (Result.isFailure(attachment)) {
      return []
    }
    return [
      {
        id: createRemoteTargetId(
          attachment.success.sessionId,
          attachment.success.receiverId
        ),
        receiverId: attachment.success.receiverId,
        deviceName: attachment.success.deviceName,
        lastActiveAt: attachment.success.connectedAt,
      },
    ]
  })
  return Response.json({ receivers })
}

const readRealtimeWebSocketSession = (
  request: Request
): RealtimeWebSocketSession | undefined => {
  const sessionId = request.headers.get("X-Lynvo-Session-Id")
  const userId = request.headers.get("X-Lynvo-User-Id")
  const receiverId = request.headers.get("X-Lynvo-Receiver-Id")
  const deviceName = request.headers.get("X-Lynvo-Receiver-Name")
  if (!sessionId || !userId || !receiverId || !deviceName) {
    return undefined
  }
  return { sessionId, userId, receiverId, deviceName }
}

const configureRealtimeWebSocket = (
  context: DurableObjectState,
  server: WebSocket,
  session: RealtimeWebSocketSession
): void => {
  for (const existingSocket of context.getWebSockets(session.receiverId)) {
    existingSocket.close(1000, "Receiver replaced")
  }
  server.serializeAttachment({
    sessionId: session.sessionId,
    receiverId: session.receiverId,
    deviceName: session.deviceName,
    connectedAt: Date.now(),
  })
  context.acceptWebSocket(server, [session.sessionId, session.receiverId])
}

const readRealtimeDataVersion = async (
  env: Env,
  userId: string
): Promise<number | undefined> => {
  const database = getD1Database(env)
  if (!database) {
    return undefined
  }
  try {
    const dataVersion = await getDataVersion(database, userId)
    return dataVersion > 0 ? dataVersion : undefined
  } catch {
    return undefined
  }
}

const sendRealtimeSessionHello = (
  server: WebSocket,
  session: RealtimeWebSocketSession,
  dataVersion: number | undefined
): void => {
  const helloPayload: RealtimeSessionHelloPayload = {
    type: "session_hello",
    userId: session.userId,
    sessionId: session.sessionId,
  }
  if (dataVersion !== undefined) {
    helloPayload.dataVersion = dataVersion
  }
  server.send(JSON.stringify(helloPayload))
}

const scheduleRealtimeSessionAlarm = async (
  storage: DurableObjectStorage
): Promise<void> => {
  const nextAlarmAt = Date.now() + REALTIME_SESSION_REVALIDATION_INTERVAL_MS
  const existingAlarmAt = await storage.getAlarm()
  if (existingAlarmAt === null || existingAlarmAt > nextAlarmAt) {
    await storage.setAlarm(nextAlarmAt)
  }
}

const acceptRealtimeWebSocket = async (
  context: DurableObjectState,
  env: Env,
  request: Request
): Promise<Response> => {
  const pair = new WebSocketPair()
  const [client, server] = Object.values(pair)
  const session = readRealtimeWebSocketSession(request)
  if (!session) {
    return new Response("Missing session", { status: 401 })
  }
  configureRealtimeWebSocket(context, server, session)
  const dataVersion = await readRealtimeDataVersion(env, session.userId)
  sendRealtimeSessionHello(server, session, dataVersion)
  await scheduleRealtimeSessionAlarm(context.storage)
  return new Response(null, { status: 101, webSocket: client })
}

export class UserRealtimeRoom extends DurableObject<Env> {
  constructor(context: DurableObjectState, env: Env) {
    super(context, env)
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong")
    )
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname.endsWith("/notify-data-changed")) {
      return handleRealtimeDataChanged(this.ctx, request)
    }
    if (pathname.endsWith("/notify-inbox")) {
      return handleRealtimeInboxNotification(this.ctx, request)
    }
    if (pathname.endsWith("/revoke-session")) {
      return handleRealtimeSessionRevocation(this.ctx, request)
    }
    if (pathname.endsWith("/revoke-account")) {
      return handleRealtimeAccountRevocation(this.ctx)
    }
    if (pathname.endsWith("/receivers")) {
      return handleRealtimeReceivers(this.ctx)
    }
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 })
    }
    return acceptRealtimeWebSocket(this.ctx, this.env, request)
  }

  async alarm(): Promise<void> {
    const database = getD1Database(this.env)
    try {
      if (database) {
        await Promise.all(
          this.ctx.getWebSockets().map(async (socket) => {
            try {
              const attachment = Schema.decodeUnknownResult(
                receiverAttachmentSchema
              )(socket.deserializeAttachment())
              if (Result.isFailure(attachment)) {
                socket.close(
                  REALTIME_SESSION_REVOKED_CLOSE_CODE,
                  "Session invalid"
                )
                return
              }
              const activeSession = await findActiveSessionById(
                database,
                attachment.success.sessionId,
                Date.now()
              )
              if (!activeSession) {
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
      }
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
    const textMessage = Schema.decodeUnknownResult(Schema.String)(message)
    if (Result.isFailure(textMessage)) {
      return
    }
    try {
      const parsed = JSON.parse(textMessage.success)
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

  webSocketClose(): void {}

  webSocketError(socket: WebSocket): void {
    socket.close(1011, "WebSocket error")
  }
}

interface ScheduledMaintenanceCronInput {
  env: Env
  database: ReturnType<typeof getD1Database>
  startedAt: number
}

const runHourlyMaintenanceCron = async ({
  env,
  database,
  startedAt,
}: ScheduledMaintenanceCronInput): Promise<void> => {
  const manifestRefresh = database
    ? await refreshCustomPluginServerManifests(env, database).catch((error) => {
        console.warn("plugin_server_manifest_refresh_unavailable", {
          operation: "plugin_server_manifest_refresh_unavailable",
          error: error instanceof Error ? error.message : String(error),
        })
        return { refreshed: 0, failed: 0 }
      })
    : { refreshed: 0, failed: 0 }
  console.info("plugin_server_manifest_refresh", {
    operation: "plugin_server_manifest_refresh",
    refreshed_count: manifestRefresh.refreshed,
    failed_count: manifestRefresh.failed,
  })
  const outcomes = database ? await runHourlyD1Maintenance(database) : []
  const failed = outcomes.some((outcome) => outcome.kind === "unavailable")
  console.info("scheduled_hourly_maintenance", {
    operation: "scheduled_hourly_maintenance",
    outcome: failed ? "failure" : "success",
    duration_ms: Math.max(0, performance.now() - startedAt),
  })
  if (failed) {
    throw new Error("D1 hourly maintenance is unavailable")
  }
}

interface ScheduledRetentionCronInput {
  database: ReturnType<typeof getD1Database>
  startedAt: number
}

const runDailyRetentionCron = async ({
  database,
  startedAt,
}: ScheduledRetentionCronInput): Promise<void> => {
  const outcome = database
    ? await runDailyD1Maintenance(database)
    : { kind: "skipped" as const }
  const failed = outcome.kind === "unavailable"
  console.info("scheduled_daily_retention", {
    operation: "scheduled_daily_retention",
    outcome: failed ? "failure" : "success",
    duration_ms: Math.max(0, performance.now() - startedAt),
  })
  if (failed) {
    throw new Error("D1 daily retention maintenance is unavailable")
  }
}

export default {
  fetch: (request, env, context) => app.fetch(request, env, context),
  scheduled: async (controller, env) => {
    const startedAt = performance.now()
    const database = getD1Database(env)
    if (controller.cron === CRON_SCHEDULE_HOURLY_MAINTENANCE) {
      await runHourlyMaintenanceCron({ env, database, startedAt })
      return
    }
    if (controller.cron === CRON_SCHEDULE_DAILY_RETENTION) {
      await runDailyRetentionCron({ database, startedAt })
      return
    }
    // A rejection in any branch must not skip the outcome logging of the
    // others, so each branch carries its own catch.
    const [notificationResult, d1SweepOutcome, d1MaintenanceOutcomes] =
      await Promise.all([
        createRemoteCommandNotificationDelivery(env, database)
          .drain()
          .catch((cause: unknown) => {
            console.error("remote_command_drain_failed", {
              operation: "remote_command_drain_failed",
              error: toFailureMessage(cause),
            })
            return { kind: "unavailable" as const }
          }),
        database
          ? sweepD1AuthData(database)
          : Promise.resolve({ kind: "skipped" as const }),
        database
          ? runHighFrequencyD1Maintenance(database)
          : Promise.resolve<MaintenanceOutcome[]>([]),
        database
          ? processQueuedLinkExtractions(env, database).catch(
              (cause: unknown) => {
                console.error("queued_extraction_drain_failed", {
                  operation: "queued_extraction_drain_failed",
                  error: toFailureMessage(cause),
                })
              }
            )
          : Promise.resolve(),
      ])
    const unavailable = d1MaintenanceOutcomes.filter(
      (outcome) => outcome.kind === "unavailable"
    ).length
    console.info("scheduled_delivery_drain", {
      operation: "scheduled_delivery_drain",
      outcome:
        notificationResult.kind === "unavailable" ||
        d1SweepOutcome.kind === "unavailable" ||
        unavailable > 0
          ? "failure"
          : "success",
      unavailable,
      d1_sweep: d1SweepOutcome.kind,
      duration_ms: Math.max(0, performance.now() - startedAt),
    })
    if (
      notificationResult.kind === "unavailable" ||
      d1SweepOutcome.kind === "unavailable" ||
      unavailable > 0
    ) {
      throw new Error("Scheduled maintenance drain failed")
    }
  },
} satisfies ExportedHandler<Env>

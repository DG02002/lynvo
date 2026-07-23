import { Hono } from "hono"
import { initLogger } from "evlog"
import { DurableObject } from "cloudflare:workers"
import { createRequestHandler, RouterContextProvider } from "react-router"
import { Context, Effect } from "effect"
import { AuthSessionService } from "../app/lib/effect/services/AuthSessionService"
import { CloudflareEnv } from "../app/lib/effect/services/CloudflareEnv"
import { ConvexService } from "../app/lib/effect/services/ConvexService"
import { ExtractorService } from "../app/lib/effect/services/ExtractorService"
import { PluginCredentialVault } from "../app/lib/effect/services/plugin-credential-vault"
import { getRuntime } from "../app/lib/effect/runtime"
import { RequestEventService } from "../app/lib/effect/services/request-event-service"
import { handler as apiHandler } from "../app/lib/effect/api/Server"
import { signAuthPreflightToken } from "../app/lib/auth-gateway"
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
} from "../convex/constants"
import {
  addRequestContext,
  requestLogging,
  type RequestLoggingEnvironment,
} from "./request-logging"

const reactRouterHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
)

initLogger({
  env: { service: "lynvo" },
})

const app = new Hono<RequestLoggingEnvironment>()

app.use("/api/*", requestLogging())

type AuthEnv = Env & {
  readonly AUTH_GATEWAY_SECRET?: string
  readonly AUTH_RATE_LIMITS?: KVNamespace
  readonly TURNSTILE_SECRET_KEY?: string
}

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
): Promise<boolean> => {
  if (import.meta.env.DEV) {
    return true
  }
  const store = env.AUTH_RATE_LIMITS
  if (!store) {
    return true
  }
  const current = Number((await store.get(key)) ?? "0")
  if (current >= limit) {
    return false
  }
  await store.put(key, String(current + 1), {
    expirationTtl: windowSeconds,
  })
  return true
}

const verifyTurnstile = async (
  env: AuthEnv,
  request: Request,
  token: string | undefined
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
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: form,
    }
  )
  if (!response.ok) {
    return false
  }
  const result = turnstileVerificationResponseSchema.safeParse(
    await response.json()
  )
  if (!result.success || !result.data.success) {
    return false
  }
  if (result.data.hostname) {
    const expected = new URL(request.url).hostname
    return result.data.hostname === expected || expected === "localhost"
  }
  return true
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
      { error: "You do not have access to this request." },
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
      return context.json({ error: "Send a valid request." }, 400)
    }
    payload = result.data
  } catch {
    return context.json({ error: "Send a valid request." }, 400)
  }
  const flow = payload.flow
  addRequestContext(context, { auth_flow: flow })
  const username = payload.username ?? ""
  const normalizedUsername = normalizeUsername(username)
  const usernameError = validateUsername(username)
  if ((flow !== "signUp" && flow !== "signIn") || usernameError) {
    return context.json({ error: usernameError ?? "Start sign-in again." }, 400)
  }
  const ip = clientIp(context.req.raw)
  const rateKey =
    flow === "signUp"
      ? `auth:signup:${ip}`
      : `auth:signin:${ip}:${normalizedUsername}`
  const allowed = await rateLimit(env, rateKey, flow === "signUp" ? 5 : 10, 600)
  if (!allowed) {
    addRequestContext(context, { rate_limit: { allowed: false } })
    return context.json({ error: "Too many attempts. Try again later." }, 429)
  }
  const turnstileOk = await verifyTurnstile(
    env,
    context.req.raw,
    payload.turnstileToken
  )
  if (!turnstileOk) {
    addRequestContext(context, { turnstile: { verified: false } })
    return context.json({ error: "Complete the security check." }, 400)
  }
  if (!env.AUTH_GATEWAY_SECRET) {
    addRequestContext(context, {
      configuration_error: "missing_auth_gateway_secret",
    })
    return context.json(
      { error: "Sign-in is unavailable. Try again later." },
      500
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
      { error: "You do not have access to this request." },
      403
    )
  }
  const env = context.env as AuthEnv
  let payload
  try {
    const result = deviceCodeRequestSchema.safeParse(await context.req.json())
    if (!result.success) {
      return context.json({ error: "Send a valid request." }, 400)
    }
    payload = result.data
  } catch {
    return context.json({ error: "Send a valid request." }, 400)
  }
  const allowed = await rateLimit(
    env,
    `auth:device-code:${clientIp(context.req.raw)}`,
    DEVICE_CODE_CREATION_RATE_LIMIT,
    DEVICE_CODE_CREATION_RATE_WINDOW_SECONDS
  )
  if (!allowed) {
    addRequestContext(context, { rate_limit: { allowed: false } })
    return context.json({ error: "Too many attempts. Try again later." }, 429)
  }
  if (!env.AUTH_GATEWAY_SECRET) {
    addRequestContext(context, {
      configuration_error: "missing_auth_gateway_secret",
    })
    return context.json(
      { error: "Sign-in is unavailable. Try again later." },
      500
    )
  }
  const preflightToken = await signAuthPreflightToken(
    {
      purpose: "deviceCode",
      exp: Date.now() + DEVICE_CODE_PREFLIGHT_TTL_MS,
    },
    env.AUTH_GATEWAY_SECRET
  )
  const convex = new ConvexHttpClient(env.VITE_CONVEX_URL)
  const result = await convex.mutation(api.tv.generateCode, {
    deviceName: payload.deviceName ?? "Unknown Device",
    preflightToken,
  })
  addRequestContext(context, { rate_limit: { allowed: true } })
  return context.json(result)
})

app.post("/api/auth/sign-in", async (context) => {
  addRequestContext(context, { operation: "auth_sign_in" })
  if (!isSameOriginRequest(context.req.raw)) {
    return context.json(
      { error: "You do not have access to this request." },
      403
    )
  }
  let payload
  try {
    const result = authSignInRequestSchema.safeParse(await context.req.json())
    if (!result.success) {
      return context.json({ error: "Send a valid request." }, 400)
    }
    payload = result.data
  } catch {
    return context.json({ error: "Send a valid request." }, 400)
  }
  const flow = payload.params.flow
  try {
    const client = new ConvexHttpClient(context.env.VITE_CONVEX_URL)
    const result = await client.action(api.auth.signIn, {
      provider: payload.provider,
      params: payload.params,
    })
    addRequestContext(context, {
      auth_flow: flow,
      has_tokens: Boolean((result as { tokens?: unknown }).tokens),
    })
    return context.json(result)
  } catch (error) {
    addRequestContext(context, {
      auth_flow: flow,
      error: {
        type: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
      },
    })
    return context.json(
      { error: "Unable to sign in. Check the details and try again." },
      400
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

app.all("/api/*", async (context) => {
  addRequestContext(context, { operation: context.req.path })
  const runtime = getRuntime(context.env)
  const services = await runtime.runPromise(
    Effect.all([
      AuthSessionService,
      ConvexService,
      ExtractorService,
      PluginCredentialVault,
    ])
  )
  const effectContext = Context.empty().pipe(
    Context.add(CloudflareEnv, context.env),
    Context.add(AuthSessionService, services[0]),
    Context.add(ConvexService, services[1]),
    Context.add(ExtractorService, services[2]),
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

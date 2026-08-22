import type { Hono } from "hono"
import { z } from "zod"
import {
  DEVICE_POLL_RATE_LIMIT,
  DEVICE_POLL_RATE_WINDOW_SECONDS,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
} from "../constants"
import {
  checkAuthenticationRateLimit,
  checkRateLimit,
} from "../authentication-rate-limit"
import {
  addRequestContext,
  type RequestLoggingEnvironment,
} from "../request-logging"
import { isSameOriginRequest } from "../same-origin"
import { getD1Database } from "./db"
import {
  createGoogleSignInStart,
  exchangeGoogleAuthorizationCode,
  normalizeGoogleReturnTo,
  parseVerifiedGoogleProfile,
  readGoogleCallbackRequest,
  readGoogleStateCookie,
  type GoogleOAuthCredentials,
} from "./google-auth"
import {
  createD1SessionCookie,
  createSession,
  resolveD1Session,
} from "./sessions"
import { getOrCreateGoogleUser } from "./users"
import {
  abortDeviceExchange,
  authorizeDeviceCode,
  claimAuthorizedCode,
  finalizeDeviceExchange,
  getDeviceCodeForApproval,
  getDeviceCodeStatus,
  recoverDeviceExchange,
} from "./device-auth"

const resolveGoogleCredentials = (env: Env): GoogleOAuthCredentials | null => {
  // SAFETY: secrets are declared required in wrangler.jsonc but may be absent on unprovisioned runtimes.
  const provisionedEnv = env as Partial<
    Record<"GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET", string>
  >
  const clientId = provisionedEnv.GOOGLE_CLIENT_ID
  const clientSecret = provisionedEnv.GOOGLE_CLIENT_SECRET
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

const clientIp = (request: Request): string =>
  request.headers.get("CF-Connecting-IP") ??
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  "unknown"

const unauthorizedResponse = () => new Response("Unauthorized", { status: 401 })

const codeSchema = z.object({ code: z.string().min(1) })

const exchangeStartSchema = z.object({
  code: z.string().min(1),
  pollSecret: z.string().min(1),
  attemptId: z.string().min(1),
  generation: z.number().int().positive(),
})

const finalizeSchema = exchangeStartSchema.extend({
  sessionId: z.string().min(1),
})

const abortSchema = finalizeSchema.omit({ pollSecret: true })

export const registerD1AuthRoutes = (
  app: Hono<RequestLoggingEnvironment>
): void => {
  app.get("/api/auth/sign-in/google", async (context) => {
    addRequestContext(context, { operation: "google_sign_in_start" })
    const env = context.env
    const database = getD1Database(env)
    const credentials = resolveGoogleCredentials(env)
    if (!database || !credentials) {
      return context.text("Google sign-in is not configured", 503)
    }
    const rateLimitResult = await checkAuthenticationRateLimit(
      env,
      `auth:google-start:${clientIp(context.req.raw)}`,
      10,
      600
    )
    if (rateLimitResult !== "allowed") {
      return context.text("Too many attempts. Try again later.", 429)
    }
    const returnTo = normalizeGoogleReturnTo(
      new URL(context.req.raw.url).searchParams.get("returnTo") ?? undefined
    )
    const { redirectUrl, stateCookie } = await createGoogleSignInStart({
      credentials,
      origin: new URL(context.req.raw.url).origin,
      returnTo,
      now: Date.now(),
    })
    context.header("Set-Cookie", stateCookie)
    return context.redirect(redirectUrl, 302)
  })

  app.get("/api/auth/callback/google", async (context) => {
    addRequestContext(context, { operation: "google_sign_in_callback" })
    const env = context.env
    const database = getD1Database(env)
    const credentials = resolveGoogleCredentials(env)
    if (!database || !credentials) {
      return context.text("Google sign-in is not configured", 503)
    }
    const loginRedirect = (reason: string) =>
      context.redirect(`/auth/log-in?error=${reason}`, 302)
    const callback = readGoogleCallbackRequest(context.req.raw)
    if (callback.error || !callback.code || !callback.state) {
      return loginRedirect(callback.error ?? "missing_code")
    }
    const statePayload = await readGoogleStateCookie(
      context.req.raw,
      credentials.clientSecret
    )
    context.header(
      "Set-Cookie",
      `${GOOGLE_OAUTH_STATE_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
    )
    if (
      !statePayload ||
      statePayload.state !== callback.state ||
      statePayload.expiresAt <= Date.now()
    ) {
      addRequestContext(context, { oauth_outcome: "state_mismatch" })
      return loginRedirect("state")
    }
    const idToken = await exchangeGoogleAuthorizationCode({
      credentials,
      redirectUri: `${new URL(context.req.raw.url).origin}/api/auth/callback/google`,
      code: callback.code,
      codeVerifier: statePayload.codeVerifier,
    })
    if (!idToken) {
      addRequestContext(context, { oauth_outcome: "token_exchange_failed" })
      return loginRedirect("exchange")
    }
    const profile = parseVerifiedGoogleProfile(idToken, credentials, Date.now())
    if (!profile) {
      addRequestContext(context, { oauth_outcome: "invalid_id_token" })
      return loginRedirect("invalid_token")
    }
    const { user, didCreate } = await getOrCreateGoogleUser(database, {
      googleSubject: profile.subject,
      email: profile.email,
      displayName: profile.displayName ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
      now: Date.now(),
    })
    const session = await createSession(database, {
      userId: user.id,
      userAgent: context.req.header("User-Agent"),
      now: Date.now(),
    })
    addRequestContext(context, {
      oauth_outcome: "authenticated",
      user_created: didCreate,
      user_id: user.id,
    })
    context.header("Set-Cookie", createD1SessionCookie(session.id))
    return context.redirect(statePayload.returnTo, 302)
  })

  app.get("/api/auth/device/status", async (context) => {
    const database = getD1Database(context.env)
    if (!database) {
      return context.text("Device sign-in is not configured", 503)
    }
    addRequestContext(context, {
      operation: "device_status_read",
      backend: "d1",
    })
    const rateLimitResult = await checkRateLimit(
      context.env,
      `auth:device-poll:${clientIp(context.req.raw)}`,
      DEVICE_POLL_RATE_LIMIT,
      DEVICE_POLL_RATE_WINDOW_SECONDS
    )
    if (rateLimitResult !== "allowed") {
      return context.json({ status: "rate_limited" }, 429)
    }
    const code = context.req.query("code")
    const pollSecret = context.req.query("pollSecret")
    if (!code || !pollSecret) {
      return context.json({ status: "invalid" }, 400)
    }
    const outcome = await getDeviceCodeStatus(database, { code, pollSecret })
    return context.json(
      outcome.kind === "invalid"
        ? { status: "invalid" }
        : {
            status: outcome.status,
            deviceName: outcome.deviceName,
            expiresAt: outcome.expiresAt,
          }
    )
  })

  app.get("/api/auth/device/approval", async (context) => {
    const database = getD1Database(context.env)
    if (!database) {
      return context.text("Device sign-in is not configured", 503)
    }
    addRequestContext(context, {
      operation: "device_approval_read",
      backend: "d1",
    })
    const session = await resolveD1Session(context.req.raw, database)
    if (!session) {
      return unauthorizedResponse()
    }
    const code = context.req.query("code")
    if (!code) {
      return context.json(null, 400)
    }
    return context.json(await getDeviceCodeForApproval(database, code))
  })

  app.post("/api/auth/device/authorize", async (context) => {
    const database = getD1Database(context.env)
    if (!database) {
      return context.text("Device sign-in is not configured", 503)
    }
    addRequestContext(context, { operation: "device_authorize", backend: "d1" })
    if (!isSameOriginRequest(context.req.raw)) {
      return context.text("Forbidden", 403)
    }
    const session = await resolveD1Session(context.req.raw, database)
    if (!session) {
      return unauthorizedResponse()
    }
    const parsed = codeSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      return context.json({ error: "Enter the code shown on the device" }, 400)
    }
    const outcome = await authorizeDeviceCode(database, {
      code: parsed.data.code,
      userId: session.userId,
      now: Date.now(),
    })
    if (outcome.kind === "authorized") {
      return context.json({ success: true })
    }
    return context.json(
      {
        error:
          outcome.kind === "unknownCode"
            ? "Enter the code shown on the device"
            : "This code was used or has expired. Generate a new code.",
      },
      409
    )
  })

  app.get("/api/auth/device/exchange", async (context) => {
    addRequestContext(context, { operation: "device_exchange_claim" })
    const database = getD1Database(context.env)
    if (!database) {
      return context.text("Device exchange is not configured", 503)
    }
    const rateLimitResult = await checkRateLimit(
      context.env,
      `auth:device-exchange:${clientIp(context.req.raw)}`,
      DEVICE_POLL_RATE_LIMIT,
      DEVICE_POLL_RATE_WINDOW_SECONDS
    )
    if (rateLimitResult !== "allowed") {
      return context.text("Too many attempts. Try again later.", 429)
    }
    const parsed = exchangeStartSchema.safeParse({
      code: context.req.query("code"),
      pollSecret: context.req.query("pollSecret"),
      attemptId: context.req.query("attemptId"),
      generation: Number(context.req.query("generation")),
    })
    if (!parsed.success) {
      return context.json({ error: "Invalid exchange request" }, 400)
    }
    const outcome = await claimAuthorizedCode(database, {
      ...parsed.data,
      now: Date.now(),
    })
    if (outcome.kind === "claimed") {
      return context.json({
        userId: outcome.userId,
        deviceName: outcome.deviceName,
        sessionId: outcome.sessionId,
      })
    }
    return context.json(
      { error: "Approve this code on the signed-in device" },
      outcome.kind === "invalidExchangeSession" ? 409 : 403
    )
  })

  app.post("/api/auth/device/exchange/finalize", async (context) => {
    addRequestContext(context, { operation: "device_exchange_finalize" })
    const database = getD1Database(context.env)
    if (!database) {
      return context.text("Device exchange is not configured", 503)
    }
    if (!isSameOriginRequest(context.req.raw)) {
      return context.text("Forbidden", 403)
    }
    const parsed = finalizeSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      return context.json({ error: "Invalid finalize request" }, 400)
    }
    const outcome = await finalizeDeviceExchange(database, parsed.data)
    if (outcome.kind === "superseded") {
      return context.json({ error: "Device code exchange was superseded" }, 409)
    }
    context.header("Set-Cookie", createD1SessionCookie(parsed.data.sessionId))
    return context.json({ success: true })
  })

  app.get("/api/auth/device/exchange/recovery", async (context) => {
    addRequestContext(context, { operation: "device_exchange_recovery" })
    const database = getD1Database(context.env)
    if (!database) {
      return context.text("Device exchange is not configured", 503)
    }
    const session = await resolveD1Session(context.req.raw, database)
    if (!session) {
      return unauthorizedResponse()
    }
    const code = context.req.query("code")
    const pollSecret = context.req.query("pollSecret")
    const attemptId = context.req.query("attemptId")
    if (!code || !pollSecret || !attemptId) {
      return context.json({ outcome: "invalid" }, 400)
    }
    const outcome = await recoverDeviceExchange(database, {
      userId: session.userId,
      sessionId: session.id,
      code,
      pollSecret,
      attemptId,
    })
    return context.json({ outcome })
  })

  app.post("/api/auth/device/exchange/abort", async (context) => {
    addRequestContext(context, { operation: "device_exchange_abort" })
    const database = getD1Database(context.env)
    if (!database) {
      return context.text("Device exchange is not configured", 503)
    }
    if (!isSameOriginRequest(context.req.raw)) {
      return context.text("Forbidden", 403)
    }
    const session = await resolveD1Session(context.req.raw, database)
    if (!session) {
      return unauthorizedResponse()
    }
    const parsed = abortSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      return context.json({ error: "Invalid abort request" }, 400)
    }
    const outcome = await abortDeviceExchange(database, {
      userId: session.userId,
      sessionId: session.id,
      code: parsed.data.code,
      attemptId: parsed.data.attemptId,
      generation: parsed.data.generation,
      now: Date.now(),
    })
    if (outcome.kind === "invalidSession") {
      return context.json(
        { error: "Device code exchange session is invalid" },
        409
      )
    }
    return context.json({ success: true })
  })
}

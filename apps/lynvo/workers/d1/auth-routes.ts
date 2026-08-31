import type { Context, Hono } from "hono"
import { Result, Schema } from "effect"
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
  getSafeGoogleReturnTo,
  parseVerifiedGoogleProfile,
  readGoogleCallbackRequest,
  readGoogleStateCookie,
  type GoogleOAuthCredentials,
  type GoogleProfile,
} from "./google-auth"
import {
  createD1SessionCookie,
  createSession,
  resolveD1Session,
} from "./sessions"
import { getOrCreateGoogleUser } from "./users"
import {
  authorizeDeviceCode,
  claimAuthorizedCode,
  finalizeDeviceExchange,
  getDeviceCodeForApproval,
  getDeviceCodeStatus,
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

const codeSchema = Schema.Struct({ code: Schema.NonEmptyString })

const exchangeStartSchema = Schema.Struct({
  code: Schema.NonEmptyString,
  pollSecret: Schema.NonEmptyString,
  attemptId: Schema.NonEmptyString,
  generation: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
})

const finalizeSchema = Schema.Struct({
  code: Schema.NonEmptyString,
  pollSecret: Schema.NonEmptyString,
  attemptId: Schema.NonEmptyString,
  generation: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
  sessionId: Schema.NonEmptyString,
})

type GoogleCallbackVerification =
  | { kind: "redirect"; response: Response }
  | { kind: "verified"; profile: GoogleProfile; returnTo: string | undefined }

interface VerifyGoogleCallbackInput {
  context: Context<RequestLoggingEnvironment>
  credentials: GoogleOAuthCredentials
}

const verifyGoogleCallback = async ({
  context,
  credentials,
}: VerifyGoogleCallbackInput): Promise<GoogleCallbackVerification> => {
  const loginRedirect = (reason: string) =>
    context.redirect(`/auth/log-in?error=${reason}`, 302)
  const callback = readGoogleCallbackRequest(context.req.raw)
  if (callback.error || !callback.code || !callback.state) {
    return {
      kind: "redirect",
      response: loginRedirect(callback.error ?? "missing_code"),
    }
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
    return { kind: "redirect", response: loginRedirect("state") }
  }
  const idToken = await exchangeGoogleAuthorizationCode({
    credentials,
    redirectUri: `${new URL(context.req.raw.url).origin}/api/auth/callback/google`,
    code: callback.code,
    codeVerifier: statePayload.codeVerifier,
  })
  if (!idToken) {
    addRequestContext(context, { oauth_outcome: "token_exchange_failed" })
    return { kind: "redirect", response: loginRedirect("exchange") }
  }
  const profile = parseVerifiedGoogleProfile(idToken, credentials, Date.now())
  if (!profile) {
    addRequestContext(context, { oauth_outcome: "invalid_id_token" })
    return { kind: "redirect", response: loginRedirect("invalid_token") }
  }
  return { kind: "verified", profile, returnTo: statePayload.returnTo }
}

export const registerD1AuthRoutes = (
  app: Hono<RequestLoggingEnvironment>
): void => {
  app.get("/api/auth/sign-in/google", async (context) => {
    addRequestContext(context, { operation: "google_sign_in_start" })
    const { env } = context
    const database = getD1Database(env)
    const credentials = resolveGoogleCredentials(env)
    if (!database || !credentials) {
      return context.text("Google sign-in is not configured", 503)
    }
    const rateLimitResult = await checkAuthenticationRateLimit({
      environment: env,
      key: `auth:google-start:${clientIp(context.req.raw)}`,
      limit: 10,
      windowSeconds: 600,
    })
    if (rateLimitResult !== "allowed") {
      return context.text("Too many attempts. Try again later.", 429)
    }
    const returnTo = getSafeGoogleReturnTo(
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
    const { env } = context
    const database = getD1Database(env)
    const credentials = resolveGoogleCredentials(env)
    if (!database || !credentials) {
      return context.text("Google sign-in is not configured", 503)
    }
    const verification = await verifyGoogleCallback({ context, credentials })
    if (verification.kind === "redirect") {
      return verification.response
    }
    const { profile, returnTo } = verification
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
    return context.redirect(getSafeGoogleReturnTo(returnTo), 302)
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
    const rateLimitResult = await checkRateLimit({
      environment: context.env,
      key: `auth:device-poll:${clientIp(context.req.raw)}`,
      limit: DEVICE_POLL_RATE_LIMIT,
      windowSeconds: DEVICE_POLL_RATE_WINDOW_SECONDS,
    })
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
    const parsed = Schema.decodeUnknownResult(codeSchema)(
      await context.req.json().catch(() => null)
    )
    if (Result.isFailure(parsed)) {
      return context.json({ error: "Enter the code shown on the device" }, 400)
    }
    const outcome = await authorizeDeviceCode(database, {
      code: parsed.success.code,
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
    const rateLimitResult = await checkRateLimit({
      environment: context.env,
      key: `auth:device-exchange:${clientIp(context.req.raw)}`,
      limit: DEVICE_POLL_RATE_LIMIT,
      windowSeconds: DEVICE_POLL_RATE_WINDOW_SECONDS,
    })
    if (rateLimitResult !== "allowed") {
      return context.text("Too many attempts. Try again later.", 429)
    }
    const parsed = Schema.decodeUnknownResult(exchangeStartSchema)({
      code: context.req.query("code"),
      pollSecret: context.req.query("pollSecret"),
      attemptId: context.req.query("attemptId"),
      generation: Number(context.req.query("generation")),
    })
    if (Result.isFailure(parsed)) {
      return context.json({ error: "Invalid exchange request" }, 400)
    }
    const outcome = await claimAuthorizedCode(database, {
      ...parsed.success,
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
    const parsed = Schema.decodeUnknownResult(finalizeSchema)(
      await context.req.json().catch(() => null)
    )
    if (Result.isFailure(parsed)) {
      return context.json({ error: "Invalid finalize request" }, 400)
    }
    const outcome = await finalizeDeviceExchange(database, parsed.success)
    if (outcome.kind === "superseded") {
      return context.json({ error: "Device code exchange was superseded" }, 409)
    }
    context.header(
      "Set-Cookie",
      createD1SessionCookie(parsed.success.sessionId)
    )
    return context.json({ success: true })
  })
}

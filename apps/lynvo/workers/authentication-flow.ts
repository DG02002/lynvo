import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api"
import { createAuthSessionModule, type AuthSessionState } from "./auth-session"
import { createSignedInSessionLifecycle } from "./signed-in-session-lifecycle"
import { createSessionCleanupModule } from "./session-cleanup"

interface AuthenticationFlowEnvironment {
  readonly VITE_CONVEX_URL: string
  readonly WORKER_AUTH_SESSION: Env["WORKER_AUTH_SESSION"]
  readonly AUTH_GATEWAY_SECRET: string
}

interface AuthenticationFlowInput {
  readonly provider: "credentials"
  readonly params: Record<string, string>
}

interface AuthenticationFlowBrowserState {
  readonly signingIn?: boolean
  readonly redirect?: string
  readonly started?: boolean
}

interface AuthenticationFlowCompleted {
  readonly kind: "completed"
  readonly browserState: AuthenticationFlowBrowserState
  readonly cookie?: string
  readonly hasTokens: boolean
}

interface AuthenticationFlowUnavailable {
  readonly kind: "unavailable"
}

interface AuthenticationTokens {
  readonly token: string
  readonly refreshToken: string
}

const readConvexSessionId = (accessToken: string): string | undefined => {
  const payloadSegment = accessToken.split(".")[1]
  if (!payloadSegment) {
    return undefined
  }
  try {
    const normalizedSegment = payloadSegment
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(payloadSegment.length / 4) * 4, "=")
    const payload: unknown = JSON.parse(atob(normalizedSegment))
    return typeof payload === "object" &&
      payload !== null &&
      "sessionId" in payload &&
      typeof payload.sessionId === "string" &&
      payload.sessionId.length > 0
      ? payload.sessionId
      : undefined
  } catch {
    return undefined
  }
}

const readRefreshTokenId = (refreshToken: string): string | undefined =>
  refreshToken.split("|")[0] || undefined

interface WorkerAuthenticationFlow {
  readonly signIn: (
    input: AuthenticationFlowInput
  ) => Promise<AuthenticationFlowCompleted | AuthenticationFlowUnavailable>
}

const readTokens = (value: unknown): AuthenticationTokens | undefined => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("tokens" in value) ||
    typeof value.tokens !== "object" ||
    value.tokens === null ||
    !("token" in value.tokens) ||
    !("refreshToken" in value.tokens) ||
    typeof value.tokens.token !== "string" ||
    typeof value.tokens.refreshToken !== "string"
  ) {
    return undefined
  }
  return {
    token: value.tokens.token,
    refreshToken: value.tokens.refreshToken,
  }
}

const readBrowserState = (value: unknown): AuthenticationFlowBrowserState => {
  if (typeof value !== "object" || value === null) {
    return {}
  }
  return {
    signingIn:
      "signingIn" in value && typeof value.signingIn === "boolean"
        ? value.signingIn
        : undefined,
    redirect:
      "redirect" in value && typeof value.redirect === "string"
        ? value.redirect
        : undefined,
    started:
      "started" in value && typeof value.started === "boolean"
        ? value.started
        : undefined,
  }
}

export const createWorkerAuthenticationFlow = (
  environment: AuthenticationFlowEnvironment
): WorkerAuthenticationFlow => ({
  signIn: async (input) => {
    const client = new ConvexHttpClient(environment.VITE_CONVEX_URL)
    const exchangeAttemptId =
      input.params.flow === "device"
        ? input.params.exchangeAttemptId
        : undefined
    const authSession = createAuthSessionModule(environment.WORKER_AUTH_SESSION)
    const cleanup = createSessionCleanupModule(environment)
    const recoverExistingDeviceSession = async (
      session: AuthSessionState,
      attemptId: string
    ): Promise<AuthenticationFlowCompleted | AuthenticationFlowUnavailable> => {
      client.setAuth(session.accessToken)
      try {
        const recoveryPhase = await client.query(
          api.deviceAuth.recoverExchange,
          {
            code: input.params.code,
            pollSecret: input.params.pollSecret,
            attemptId,
          }
        )
        if (recoveryPhase === "resumable") {
          await client.mutation(api.users.linkCurrentSessionWorker, {
            workerSessionId: attemptId,
          })
          await client.mutation(api.deviceAuth.finalizeExchange, {
            code: input.params.code,
            pollSecret: input.params.pollSecret,
            attemptId,
            sessionId: session.convexSessionId,
          })
        }
        if (recoveryPhase === "resumable" || recoveryPhase === "completed") {
          return {
            kind: "completed",
            browserState: { signingIn: true },
            cookie: authSession.restoreCookie(attemptId),
            hasTokens: true,
          }
        }
        await client.mutation(api.deviceAuth.abortDeviceExchange, {
          code: input.params.code,
          attemptId,
          sessionId: session.convexSessionId,
        })
      } catch {
        return { kind: "unavailable" }
      }
      const cleanupResult = await cleanup.drain()
      return cleanupResult.kind === "unavailable"
        ? cleanupResult
        : { kind: "unavailable" }
    }
    let issuanceGenerationId: string | undefined
    if (exchangeAttemptId) {
      const existingSession = await authSession.read(exchangeAttemptId)
      if (existingSession.kind === "unavailable") {
        return existingSession
      }
      if (existingSession.kind === "active") {
        return await recoverExistingDeviceSession(
          existingSession.session,
          exchangeAttemptId
        )
      }
      issuanceGenerationId = crypto.randomUUID()
      const issuance = await authSession.beginIssuance({
        sessionId: exchangeAttemptId,
        generationId: issuanceGenerationId,
        nowMs: Date.now(),
      })
      if (issuance.kind !== "acquired") {
        if (issuance.kind === "unavailable") {
          return issuance
        }
        const issuedSession = await authSession.read(exchangeAttemptId)
        return issuedSession.kind === "active"
          ? await recoverExistingDeviceSession(
              issuedSession.session,
              exchangeAttemptId
            )
          : { kind: "unavailable" }
      }
    }
    const result = await client.action(
      api.auth.signIn,
      issuanceGenerationId
        ? {
            ...input,
            params: {
              ...input.params,
              issuanceGenerationId,
            },
          }
        : input
    )
    const tokens = readTokens(result)
    if (!tokens) {
      return {
        kind: "completed",
        browserState: readBrowserState(result),
        hasTokens: false,
      }
    }
    const deviceName = input.params.deviceName?.trim().slice(0, 80)
    const convexSessionId = readConvexSessionId(tokens.token)
    if (!convexSessionId) {
      return { kind: "unavailable" }
    }
    client.setAuth(tokens.token)
    if (exchangeAttemptId && issuanceGenerationId) {
      const refreshTokenId = readRefreshTokenId(tokens.refreshToken)
      if (!refreshTokenId) {
        return { kind: "unavailable" }
      }
      const issuanceStatus = await client.mutation(
        api.deviceAuth.commitExchangeIssuance,
        {
          code: input.params.code,
          attemptId: exchangeAttemptId,
          generationId: issuanceGenerationId,
          refreshTokenId,
        }
      )
      if (issuanceStatus !== "current") {
        return { kind: "unavailable" }
      }
    }
    if (deviceName) {
      await client.mutation(api.users.setCurrentSessionDevice, { deviceName })
    }
    const lifecycle = createSignedInSessionLifecycle(
      authSession,
      undefined,
      cleanup
    )
    const recoverDeviceExchange = async () => {
      if (!exchangeAttemptId) {
        return
      }
      try {
        await client.mutation(api.deviceAuth.abortDeviceExchange, {
          code: input.params.code,
          attemptId: exchangeAttemptId,
          sessionId: convexSessionId,
        })
      } finally {
        await cleanup.drain()
      }
    }
    const session = await lifecycle.establish({
      workerSessionId: exchangeAttemptId,
      convexSessionId,
      accessToken: tokens.token,
      refreshToken: tokens.refreshToken,
      nowMs: Date.now(),
      issuanceGenerationId,
      linkWorkerSession: async (workerSessionId) => {
        await client.mutation(api.users.linkCurrentSessionWorker, {
          workerSessionId,
        })
      },
      finalizeSession: exchangeAttemptId
        ? async () => {
            await client.mutation(api.deviceAuth.finalizeExchange, {
              code: input.params.code,
              pollSecret: input.params.pollSecret,
              attemptId: exchangeAttemptId,
              sessionId: convexSessionId,
            })
          }
        : undefined,
    })
    if (session.kind === "conflict" && exchangeAttemptId) {
      const issuedSession = await authSession.read(exchangeAttemptId)
      return issuedSession.kind === "active"
        ? await recoverExistingDeviceSession(
            issuedSession.session,
            exchangeAttemptId
          )
        : { kind: "unavailable" }
    }
    if (session.kind === "conflict") {
      return { kind: "unavailable" }
    }
    if (session.kind === "unavailable") {
      await recoverDeviceExchange()
      return session
    }
    return {
      kind: "completed",
      browserState: { signingIn: true },
      cookie: session.cookie,
      hasTokens: true,
    }
  },
})

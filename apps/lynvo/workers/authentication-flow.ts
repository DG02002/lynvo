import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api"
import { createAuthSessionModule, type AuthSessionState } from "./auth-session"
import { createSignedInSessionLifecycle } from "./signed-in-session-lifecycle"
import { createSessionCleanupModule } from "./session-cleanup"
import { z } from "zod"

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

interface AuthenticationFlowInvalidCredentials {
  readonly kind: "invalid-credentials"
}

interface AuthenticationFlowAccountExists {
  readonly kind: "account-exists"
}

interface AuthenticationTokens {
  readonly token: string
  readonly refreshToken: string
}

const convexAccessTokenPayloadSchema = z.object({
  sessionId: z.string().min(1),
})
const authenticationTokensSchema = z.object({
  tokens: z.object({ token: z.string(), refreshToken: z.string() }),
})
const authenticationFlowBrowserStateSchema = z.object({
  signingIn: z.boolean().optional(),
  redirect: z.string().optional(),
  started: z.boolean().optional(),
})

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
    const payload = convexAccessTokenPayloadSchema.safeParse(
      JSON.parse(atob(normalizedSegment))
    )
    return payload.success ? payload.data.sessionId : undefined
  } catch {
    return undefined
  }
}

const readRefreshTokenId = (refreshToken: string): string | undefined =>
  refreshToken.split("|")[0] || undefined

interface WorkerAuthenticationFlow {
  readonly signIn: (
    input: AuthenticationFlowInput
  ) => Promise<
    | AuthenticationFlowCompleted
    | AuthenticationFlowAccountExists
    | AuthenticationFlowInvalidCredentials
    | AuthenticationFlowUnavailable
  >
}

const readTokens = <Value>(value: Value): AuthenticationTokens | undefined => {
  const result = authenticationTokensSchema.safeParse(value)
  return result.success ? result.data.tokens : undefined
}

const readBrowserState = <Value>(
  value: Value
): AuthenticationFlowBrowserState => {
  const result = authenticationFlowBrowserStateSchema.safeParse(value)
  return result.success ? result.data : {}
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
      if (!session.issuanceGeneration) {
        return { kind: "unavailable" }
      }
      const issuanceGeneration = session.issuanceGeneration
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
            generation: issuanceGeneration,
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
          generation: issuanceGeneration,
        })
      } catch {
        return { kind: "unavailable" }
      }
      const cleanupResult = await cleanup.drain()
      return cleanupResult.kind === "unavailable"
        ? cleanupResult
        : { kind: "unavailable" }
    }
    let issuanceGeneration: number | undefined
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
      const issuance = await authSession.beginIssuance({
        sessionId: exchangeAttemptId,
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
      issuanceGeneration = issuance.generation
    }
    let result: unknown
    try {
      result = await client.action(
        api.auth.signIn,
        issuanceGeneration
          ? {
              ...input,
              params: {
                ...input.params,
                issuanceGeneration: String(issuanceGeneration),
              },
            }
          : input
      )
    } catch {
      return { kind: "unavailable" }
    }
    const tokens = readTokens(result)
    if (!tokens) {
      if (input.params.flow === "signIn") {
        return { kind: "invalid-credentials" }
      }
      if (input.params.flow === "signUp") {
        return { kind: "account-exists" }
      }
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
    if (exchangeAttemptId && issuanceGeneration) {
      const refreshTokenId = readRefreshTokenId(tokens.refreshToken)
      if (!refreshTokenId) {
        return { kind: "unavailable" }
      }
      const issuanceStatus = await client.mutation(
        api.deviceAuth.commitExchangeIssuance,
        {
          code: input.params.code,
          attemptId: exchangeAttemptId,
          generation: issuanceGeneration,
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
      if (!exchangeAttemptId || !issuanceGeneration) {
        return
      }
      try {
        await client.mutation(api.deviceAuth.abortDeviceExchange, {
          code: input.params.code,
          attemptId: exchangeAttemptId,
          sessionId: convexSessionId,
          generation: issuanceGeneration,
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
      issuanceGeneration,
      linkWorkerSession: async (workerSessionId) => {
        await client.mutation(api.users.linkCurrentSessionWorker, {
          workerSessionId,
        })
      },
      finalizeSession:
        exchangeAttemptId && issuanceGeneration
          ? async () => {
              await client.mutation(api.deviceAuth.finalizeExchange, {
                code: input.params.code,
                pollSecret: input.params.pollSecret,
                attemptId: exchangeAttemptId,
                sessionId: convexSessionId,
                generation: issuanceGeneration,
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

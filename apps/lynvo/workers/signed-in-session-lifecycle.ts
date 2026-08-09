import type { AuthSessionModule } from "./auth-session"

export interface EstablishSignedInSessionInput {
  readonly convexSessionId: string
  readonly accessToken: string
  readonly refreshToken: string
  readonly nowMs: number
  readonly linkWorkerSession: (workerSessionId: string) => Promise<void>
}

export interface TerminateSignedInSessionInput {
  readonly sessionId?: string
  readonly revokeConvexSession: (accessToken: string) => Promise<void>
}

export interface RevokeSignedInSessionsInput {
  readonly prepare: () => Promise<readonly string[]>
  readonly commit: () => Promise<void>
}

export interface EraseSignedInAccountInput extends RevokeSignedInSessionsInput {
  readonly eraseAccount: () => Promise<void>
}

export interface SignedInSessionCompleted {
  readonly kind: "completed"
  readonly cookie: string
}

export interface SignedInSessionUnavailable {
  readonly kind: "unavailable"
}

export interface SignedInSessionLifecycle {
  readonly establish: (
    input: EstablishSignedInSessionInput
  ) => Promise<SignedInSessionCompleted | SignedInSessionUnavailable>
  readonly terminate: (
    input: TerminateSignedInSessionInput
  ) => Promise<SignedInSessionCompleted | SignedInSessionUnavailable>
  readonly revoke: (
    input: RevokeSignedInSessionsInput
  ) => Promise<SignedInSessionCompleted | SignedInSessionUnavailable>
  readonly eraseAccount: (
    input: EraseSignedInAccountInput
  ) => Promise<SignedInSessionCompleted | SignedInSessionUnavailable>
}

const revokePreparedSessions = async (
  authSession: AuthSessionModule,
  input: RevokeSignedInSessionsInput
): Promise<SignedInSessionCompleted | SignedInSessionUnavailable> => {
  try {
    const workerSessionIds = await input.prepare()
    for (const workerSessionId of workerSessionIds) {
      const result = await authSession.revoke(workerSessionId)
      if (result.kind === "unavailable") {
        return result
      }
    }
    await input.commit()
    return { kind: "completed", cookie: authSession.expireCookie() }
  } catch {
    return { kind: "unavailable" }
  }
}

export const createSignedInSessionLifecycle = (
  authSession: AuthSessionModule
): SignedInSessionLifecycle => ({
  establish: async (input) => {
    const workerSessionId = crypto.randomUUID()
    const session = await authSession.create({
      sessionId: workerSessionId,
      convexSessionId: input.convexSessionId,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      nowMs: input.nowMs,
    })
    if (session.kind === "unavailable") {
      return session
    }
    try {
      await input.linkWorkerSession(workerSessionId)
      return { kind: "completed", cookie: session.cookie }
    } catch {
      await authSession.revoke(workerSessionId)
      return { kind: "unavailable" }
    }
  },
  terminate: async ({ sessionId, revokeConvexSession }) => {
    if (!sessionId) {
      return { kind: "completed", cookie: authSession.expireCookie() }
    }
    const activeSession = await authSession.read(sessionId)
    if (activeSession.kind === "unavailable") {
      return activeSession
    }
    if (activeSession.kind === "active") {
      try {
        await revokeConvexSession(activeSession.session.accessToken)
      } catch {
        return { kind: "unavailable" }
      }
    }
    const revokedSession = await authSession.revoke(sessionId)
    return revokedSession.kind === "revoked"
      ? { kind: "completed", cookie: revokedSession.cookie }
      : revokedSession
  },
  revoke: async (input) => revokePreparedSessions(authSession, input),
  eraseAccount: async (input) => {
    const result = await revokePreparedSessions(authSession, input)
    if (result.kind === "unavailable") {
      return result
    }
    try {
      await input.eraseAccount()
      return result
    } catch {
      return { kind: "unavailable" }
    }
  },
})

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

export interface SignedInSessionCoordinator {
  readonly revokeSession: (sessionId: string) => Promise<readonly string[]>
  readonly revokeAllSessions: () => Promise<readonly string[]>
  readonly beginAccountErasure: (
    confirmUsername: string
  ) => Promise<readonly string[]>
  readonly listPendingCleanup: () => Promise<readonly string[]>
  readonly completeCleanup: (workerSessionId: string) => Promise<void>
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
  readonly revokeSession: (
    sessionId: string
  ) => Promise<SignedInSessionCompleted | SignedInSessionUnavailable>
  readonly revokeAllSessions: () => Promise<
    SignedInSessionCompleted | SignedInSessionUnavailable
  >
  readonly eraseAccount: (
    confirmUsername: string
  ) => Promise<SignedInSessionCompleted | SignedInSessionUnavailable>
  readonly retryCleanup: () => Promise<
    SignedInSessionCompleted | SignedInSessionUnavailable
  >
}

const drainPendingCleanup = async (
  authSession: AuthSessionModule,
  coordinator: SignedInSessionCoordinator
): Promise<SignedInSessionCompleted | SignedInSessionUnavailable> => {
  try {
    const workerSessionIds = await coordinator.listPendingCleanup()
    for (const workerSessionId of workerSessionIds) {
      const result = await authSession.revoke(workerSessionId)
      if (result.kind === "unavailable") {
        return result
      }
      await coordinator.completeCleanup(workerSessionId)
    }
    return { kind: "completed", cookie: authSession.expireCookie() }
  } catch {
    return { kind: "unavailable" }
  }
}

const revokeCommittedSessions = async (
  authSession: AuthSessionModule,
  coordinator: SignedInSessionCoordinator,
  revokeConvexSessions: () => Promise<readonly string[]>
) => {
  try {
    await revokeConvexSessions()
  } catch {
    return { kind: "unavailable" } satisfies SignedInSessionUnavailable
  }
  return await drainPendingCleanup(authSession, coordinator)
}

export const createSignedInSessionLifecycle = (
  authSession: AuthSessionModule,
  coordinator?: SignedInSessionCoordinator
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
      const compensation = await authSession.revoke(workerSessionId)
      return compensation.kind === "unavailable"
        ? compensation
        : { kind: "unavailable" }
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
  revokeSession: async (sessionId) =>
    coordinator
      ? revokeCommittedSessions(authSession, coordinator, () =>
          coordinator.revokeSession(sessionId)
        )
      : { kind: "unavailable" },
  revokeAllSessions: async () =>
    coordinator
      ? revokeCommittedSessions(
          authSession,
          coordinator,
          coordinator.revokeAllSessions
        )
      : { kind: "unavailable" },
  eraseAccount: async (confirmUsername) =>
    coordinator
      ? revokeCommittedSessions(authSession, coordinator, () =>
          coordinator.beginAccountErasure(confirmUsername)
        )
      : { kind: "unavailable" },
  retryCleanup: async () =>
    coordinator
      ? drainPendingCleanup(authSession, coordinator)
      : { kind: "unavailable" },
})

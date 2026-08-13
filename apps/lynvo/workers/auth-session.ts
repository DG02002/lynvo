import { WORKER_SESSION_COOKIE_NAME } from "../app/lib/constants"
import { createSessionCookie } from "../app/lib/auth-cookie"
import {
  SESSION_ABSOLUTE_LIFETIME_MS,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_IDLE_TIMEOUT_MS,
  AUTH_ACTIVITY_TOUCH_INTERVAL_MS,
  AUTH_SESSION_ISSUANCE_LEASE_MS,
} from "./constants"
import { z } from "zod"

interface AuthSessionStoreStub {
  readonly fetch: (url: string, init?: RequestInit) => Promise<Response>
}

interface AuthSessionStoreNamespace {
  readonly getByName: (sessionId: string) => AuthSessionStoreStub
}

export interface CreateAuthSessionInput {
  readonly sessionId: string
  readonly convexSessionId: string
  readonly accessToken: string
  readonly refreshToken: string
  readonly nowMs: number
  readonly issuanceGeneration?: number
}

export interface AuthSessionCreated {
  readonly kind: "created"
  readonly cookie: string
}

export interface AuthSessionRevoked {
  readonly kind: "revoked"
  readonly cookie: string
}

export interface AuthSessionUnavailable {
  readonly kind: "unavailable"
}

export interface AuthSessionConflict {
  readonly kind: "conflict"
}

export interface AuthSessionIssuanceAcquired {
  readonly kind: "acquired"
  readonly generation: number
}

export interface AuthSessionIssuancePending {
  readonly kind: "pending"
}

export interface AuthSessionIssuanceEstablished {
  readonly kind: "established"
}

export interface AuthSessionState {
  readonly convexSessionId: string
  readonly accessToken: string
  readonly refreshToken: string
  readonly createdAt: number
  readonly expiresAt: number
  readonly issuanceGeneration?: number
}

export interface AuthSessionActive {
  readonly kind: "active"
  readonly session: AuthSessionState
}

export interface AuthSessionExpired {
  readonly kind: "expired"
}

export interface AuthSessionRevokedOrMissing {
  readonly kind: "revoked_or_missing"
}

export interface AuthSessionInvalid {
  readonly kind: "invalid"
}

export interface RotateAuthSessionTokens {
  readonly accessToken: string
  readonly refreshToken: string
}

export interface RotateAuthSessionInput {
  readonly sessionId: string
  readonly refresh: (
    refreshToken: string
  ) => Promise<RotateAuthSessionTokens | undefined>
}

export interface AuthSessionRotated {
  readonly kind: "rotated"
}

export interface AuthSessionModule {
  readonly beginIssuance: (input: {
    readonly sessionId: string
    readonly nowMs: number
  }) => Promise<
    | AuthSessionIssuanceAcquired
    | AuthSessionIssuancePending
    | AuthSessionIssuanceEstablished
    | AuthSessionUnavailable
  >
  readonly touchActivityWhenDue: (input: {
    readonly sessionId: string
    readonly nowMs: number
    readonly touch: () => Promise<void>
  }) => Promise<void>
  readonly create: (
    input: CreateAuthSessionInput
  ) => Promise<
    AuthSessionCreated | AuthSessionConflict | AuthSessionUnavailable
  >
  readonly read: (
    sessionId: string
  ) => Promise<
    | AuthSessionActive
    | AuthSessionExpired
    | AuthSessionRevokedOrMissing
    | AuthSessionInvalid
    | AuthSessionUnavailable
  >
  readonly rotate: (
    input: RotateAuthSessionInput
  ) => Promise<
    | AuthSessionRotated
    | AuthSessionExpired
    | AuthSessionRevokedOrMissing
    | AuthSessionInvalid
    | AuthSessionUnavailable
  >
  readonly revoke: (
    sessionId: string,
    issuanceGeneration?: number
  ) => Promise<AuthSessionRevoked | AuthSessionUnavailable>
  readonly expireCookie: () => string
  readonly restoreCookie: (sessionId: string) => string
}

export { createSessionCookie }

const createExpiredSessionCookie = (): string =>
  `${WORKER_SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`

const rotationRequests = new WeakMap<
  AuthSessionStoreNamespace,
  Map<string, ReturnType<AuthSessionModule["rotate"]>>
>()

const authSessionStateSchema = z
  .object({
    convexSessionId: z.string().min(1),
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    createdAt: z.number(),
    expiresAt: z.number(),
    issuanceGeneration: z.number().int().positive().optional(),
  })
  .refine((session) => session.expiresAt > session.createdAt)

const authSessionIssuanceSchema = z.object({
  generation: z.number().int().positive(),
})

const authSessionActivitySchema = z.object({ lastActivityTouchAt: z.number() })

const parseAuthSessionState = <Value>(
  value: Value
): AuthSessionState | undefined => {
  const result = authSessionStateSchema.safeParse(value)
  return result.success ? result.data : undefined
}

export const createAuthSessionModule = (
  namespace: AuthSessionStoreNamespace
): AuthSessionModule => ({
  beginIssuance: async (input) => {
    try {
      const response = await namespace
        .getByName(input.sessionId)
        .fetch("https://session.internal/session/issuance", {
          method: "POST",
          body: JSON.stringify({
            nowMs: input.nowMs,
            expiresAt: input.nowMs + AUTH_SESSION_ISSUANCE_LEASE_MS,
          }),
        })
      if (response.status === 201) {
        const value = authSessionIssuanceSchema.safeParse(await response.json())
        return value.success
          ? { kind: "acquired", generation: value.data.generation }
          : { kind: "unavailable" }
      }
      if (response.status === 200) {
        return { kind: "established" }
      }
      return response.status === 409
        ? { kind: "pending" }
        : { kind: "unavailable" }
    } catch {
      return { kind: "unavailable" }
    }
  },
  touchActivityWhenDue: async (input) => {
    try {
      const sessionStore = namespace.getByName(input.sessionId)
      const statusResponse = await sessionStore.fetch(
        "https://session.internal/activity-touch"
      )
      if (!statusResponse.ok) {
        return
      }
      const status = authSessionActivitySchema.safeParse(
        await statusResponse.json()
      )
      if (
        !status.success ||
        input.nowMs - status.data.lastActivityTouchAt <
          AUTH_ACTIVITY_TOUCH_INTERVAL_MS
      ) {
        return
      }
      await input.touch()
      await sessionStore.fetch("https://session.internal/activity-touch", {
        method: "PUT",
        body: JSON.stringify({ touchedAt: input.nowMs }),
      })
    } catch {}
  },
  expireCookie: createExpiredSessionCookie,
  restoreCookie: createSessionCookie,
  create: async (input) => {
    try {
      const response = await namespace
        .getByName(input.sessionId)
        .fetch("https://session.internal/session", {
          method: "POST",
          body: JSON.stringify({
            convexSessionId: input.convexSessionId,
            accessToken: input.accessToken,
            refreshToken: input.refreshToken,
            createdAt: input.nowMs,
            expiresAt: input.nowMs + SESSION_ABSOLUTE_LIFETIME_MS,
            idleTimeoutMs: SESSION_IDLE_TIMEOUT_MS,
            issuanceGeneration: input.issuanceGeneration,
          }),
        })
      if (response.status === 409) {
        return { kind: "conflict" }
      }
      if (!response.ok) {
        return { kind: "unavailable" }
      }
      return {
        kind: "created",
        cookie: createSessionCookie(input.sessionId),
      }
    } catch {
      return { kind: "unavailable" }
    }
  },
  read: async (sessionId) => {
    try {
      const response = await namespace
        .getByName(sessionId)
        .fetch("https://session.internal/session")
      if (response.status === 401) {
        return { kind: "expired" }
      }
      if (response.status === 404) {
        return { kind: "revoked_or_missing" }
      }
      if (response.status === 422) {
        return { kind: "invalid" }
      }
      if (!response.ok) {
        return { kind: "unavailable" }
      }
      const session = parseAuthSessionState(await response.json())
      return session ? { kind: "active", session } : { kind: "invalid" }
    } catch {
      return { kind: "unavailable" }
    }
  },
  rotate: async (input) => {
    let namespaceRequests = rotationRequests.get(namespace)
    if (!namespaceRequests) {
      namespaceRequests = new Map()
      rotationRequests.set(namespace, namespaceRequests)
    }
    const activeRequest = namespaceRequests.get(input.sessionId)
    if (activeRequest) {
      return await activeRequest
    }
    const request = (async () => {
      const current = await createAuthSessionModule(namespace).read(
        input.sessionId
      )
      if (current.kind !== "active") {
        return current
      }
      try {
        const tokens = await input.refresh(current.session.refreshToken)
        if (!tokens) {
          return { kind: "invalid" } as const
        }
        const response = await namespace
          .getByName(input.sessionId)
          .fetch("https://session.internal/session/tokens", {
            method: "PUT",
            body: JSON.stringify({
              convexSessionId: current.session.convexSessionId,
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
            }),
          })
        if (response.status === 404) {
          return { kind: "revoked_or_missing" } as const
        }
        return response.ok || response.status === 409
          ? ({ kind: "rotated" } as const)
          : ({ kind: "unavailable" } as const)
      } catch {
        return { kind: "unavailable" } as const
      }
    })()
    namespaceRequests.set(input.sessionId, request)
    try {
      return await request
    } finally {
      namespaceRequests.delete(input.sessionId)
    }
  },
  revoke: async (sessionId, issuanceGeneration) => {
    try {
      const query =
        issuanceGeneration === undefined
          ? ""
          : `?issuanceGeneration=${issuanceGeneration}`
      const response = await namespace
        .getByName(sessionId)
        .fetch(`https://session.internal/session${query}`, { method: "DELETE" })
      if (!response.ok) {
        return { kind: "unavailable" }
      }
      return { kind: "revoked", cookie: createExpiredSessionCookie() }
    } catch {
      return { kind: "unavailable" }
    }
  },
})

export {
  SESSION_ABSOLUTE_LIFETIME_MS,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_IDLE_TIMEOUT_MS,
}

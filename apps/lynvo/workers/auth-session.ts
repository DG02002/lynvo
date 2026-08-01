import { WORKER_SESSION_COOKIE_NAME } from "../app/lib/constants"
import {
  SESSION_ABSOLUTE_LIFETIME_MS,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_IDLE_TIMEOUT_MS,
} from "./constants"

interface AuthSessionStoreStub {
  readonly fetch: (url: string, init?: RequestInit) => Promise<Response>
}

interface AuthSessionStoreNamespace {
  readonly getByName: (sessionId: string) => AuthSessionStoreStub
}

export interface CreateAuthSessionInput {
  readonly sessionId: string
  readonly accessToken: string
  readonly refreshToken: string
  readonly nowMs: number
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

export interface AuthSessionState {
  readonly accessToken: string
  readonly refreshToken: string
  readonly createdAt: number
  readonly expiresAt: number
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
  readonly create: (
    input: CreateAuthSessionInput
  ) => Promise<AuthSessionCreated | AuthSessionUnavailable>
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
    sessionId: string
  ) => Promise<AuthSessionRevoked | AuthSessionUnavailable>
  readonly expireCookie: () => string
}

const createSessionCookie = (sessionId: string): string =>
  `${WORKER_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}`

const createExpiredSessionCookie = (): string =>
  `${WORKER_SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`

const parseAuthSessionState = (
  value: unknown
): AuthSessionState | undefined => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("accessToken" in value) ||
    !("refreshToken" in value) ||
    !("createdAt" in value) ||
    !("expiresAt" in value) ||
    typeof value.accessToken !== "string" ||
    typeof value.refreshToken !== "string" ||
    typeof value.createdAt !== "number" ||
    typeof value.expiresAt !== "number" ||
    value.accessToken.length === 0 ||
    value.refreshToken.length === 0 ||
    value.expiresAt <= value.createdAt
  ) {
    return undefined
  }
  return {
    accessToken: value.accessToken,
    refreshToken: value.refreshToken,
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
  }
}

export const createAuthSessionModule = (
  namespace: AuthSessionStoreNamespace
): AuthSessionModule => ({
  expireCookie: createExpiredSessionCookie,
  create: async (input) => {
    try {
      const response = await namespace
        .getByName(input.sessionId)
        .fetch("https://session.internal/session", {
          method: "POST",
          body: JSON.stringify({
            accessToken: input.accessToken,
            refreshToken: input.refreshToken,
            createdAt: input.nowMs,
            expiresAt: input.nowMs + SESSION_ABSOLUTE_LIFETIME_MS,
            idleTimeoutMs: SESSION_IDLE_TIMEOUT_MS,
          }),
        })
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
    const current = await createAuthSessionModule(namespace).read(
      input.sessionId
    )
    if (current.kind !== "active") {
      return current
    }
    try {
      const tokens = await input.refresh(current.session.refreshToken)
      if (!tokens) {
        return { kind: "invalid" }
      }
      const response = await namespace
        .getByName(input.sessionId)
        .fetch("https://session.internal/session", {
          method: "POST",
          body: JSON.stringify({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            createdAt: current.session.createdAt,
            expiresAt: current.session.expiresAt,
            idleTimeoutMs: SESSION_IDLE_TIMEOUT_MS,
          }),
        })
      return response.ok ? { kind: "rotated" } : { kind: "unavailable" }
    } catch {
      return { kind: "unavailable" }
    }
  },
  revoke: async (sessionId) => {
    try {
      const response = await namespace
        .getByName(sessionId)
        .fetch("https://session.internal/session", { method: "DELETE" })
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

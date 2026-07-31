import { describe, expect, it } from "vitest"
import {
  createAuthSessionModule,
  SESSION_ABSOLUTE_LIFETIME_MS,
  SESSION_IDLE_TIMEOUT_MS,
} from "../workers/auth-session"

const createStore = () => {
  const writes: Array<{ sessionId: string; payload: unknown }> = []
  const deletions: Array<string> = []
  return {
    writes,
    deletions,
    namespace: {
      getByName: (sessionId: string) => ({
        fetch: async (_url: string, init?: RequestInit) => {
          if (init?.method === "POST") {
            writes.push({ sessionId, payload: JSON.parse(String(init.body)) })
          }
          if (init?.method === "DELETE") {
            deletions.push(sessionId)
          }
          return new Response(null, { status: 204 })
        },
      }),
    },
  }
}

const createReadableStore = (response: Response) => ({
  getByName: () => ({ fetch: async () => response }),
})

describe("Auth Session module", () => {
  it("creates a server-held session and returns only an opaque browser cookie", async () => {
    const store = createStore()
    const authSession = createAuthSessionModule(store.namespace)

    const result = await authSession.create({
      sessionId: "opaque-session-id",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      nowMs: 1_000,
    })

    expect(result).toEqual({
      kind: "created",
      cookie:
        "__Host-lynvo-session=opaque-session-id; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000",
    })
    expect(store.writes).toEqual([
      {
        sessionId: "opaque-session-id",
        payload: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          createdAt: 1_000,
          expiresAt: 1_000 + SESSION_ABSOLUTE_LIFETIME_MS,
          idleTimeoutMs: SESSION_IDLE_TIMEOUT_MS,
        },
      },
    ])
    expect(JSON.stringify(result)).not.toContain("access-token")
    expect(JSON.stringify(result)).not.toContain("refresh-token")
  })

  it("revokes the server-held session and expires the opaque cookie", async () => {
    const store = createStore()
    const authSession = createAuthSessionModule(store.namespace)

    const result = await authSession.revoke("opaque-session-id")

    expect(result).toEqual({
      kind: "revoked",
      cookie:
        "__Host-lynvo-session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
    })
    expect(store.deletions).toEqual(["opaque-session-id"])
  })

  it("reads a valid server-held session through one classified result", async () => {
    const authSession = createAuthSessionModule(
      createReadableStore(
        Response.json({
          accessToken: "access-token",
          refreshToken: "refresh-token",
          createdAt: 1_000,
          expiresAt: 2_000,
        })
      )
    )

    await expect(authSession.read("opaque-session-id")).resolves.toEqual({
      kind: "active",
      session: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        createdAt: 1_000,
        expiresAt: 2_000,
      },
    })
  })

  it("distinguishes expired sessions from unavailable or malformed storage", async () => {
    const expired = createAuthSessionModule(
      createReadableStore(new Response(null, { status: 401 }))
    )
    const malformed = createAuthSessionModule(
      createReadableStore(Response.json({ accessToken: "access-token" }))
    )

    await expect(expired.read("opaque-session-id")).resolves.toEqual({
      kind: "expired",
    })
    await expect(malformed.read("opaque-session-id")).resolves.toEqual({
      kind: "unavailable",
    })
  })
})

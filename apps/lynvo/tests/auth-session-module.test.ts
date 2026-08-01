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
      convexSessionId: "convex-session-id",
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
          convexSessionId: "convex-session-id",
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
          convexSessionId: "convex-session-id",
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
        convexSessionId: "convex-session-id",
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
      kind: "invalid",
    })
  })

  it("rotates tokens while preserving the absolute session lifetime", async () => {
    const requests: Array<{ method: string; payload?: unknown }> = []
    const authSession = createAuthSessionModule({
      getByName: () => ({
        fetch: async (_url: string, init?: RequestInit) => {
          requests.push({
            method: init?.method ?? "GET",
            payload: init?.body ? JSON.parse(String(init.body)) : undefined,
          })
          return init?.method === "POST"
            ? new Response(null, { status: 204 })
            : Response.json({
                convexSessionId: "convex-session-id",
                accessToken: "old-access-token",
                refreshToken: "old-refresh-token",
                createdAt: 1_000,
                expiresAt: 20_000,
              })
        },
      }),
    })

    await expect(
      authSession.rotate({
        sessionId: "opaque-session-id",
        refresh: async (refreshToken) => {
          expect(refreshToken).toBe("old-refresh-token")
          return {
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
          }
        },
      })
    ).resolves.toEqual({ kind: "rotated" })
    expect(requests[1]).toEqual({
      method: "POST",
      payload: {
        convexSessionId: "convex-session-id",
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        createdAt: 1_000,
        expiresAt: 20_000,
        idleTimeoutMs: SESSION_IDLE_TIMEOUT_MS,
      },
    })
  })

  it("serializes concurrent rotation for one opaque session", async () => {
    let accessToken = "old-access-token"
    let refreshCalls = 0
    const authSession = createAuthSessionModule({
      getByName: () => ({
        fetch: async (_url: string, init?: RequestInit) => {
          if (init?.method === "POST") {
            const payload: unknown = JSON.parse(String(init.body))
            if (
              typeof payload === "object" &&
              payload !== null &&
              "accessToken" in payload &&
              typeof payload.accessToken === "string"
            ) {
              accessToken = payload.accessToken
            }
            return new Response(null, { status: 204 })
          }
          return Response.json({
            convexSessionId: "convex-session-id",
            accessToken,
            refreshToken: "refresh-token",
            createdAt: 1_000,
            expiresAt: 20_000,
          })
        },
      }),
    })
    const rotate = () =>
      authSession.rotate({
        sessionId: "opaque-session-id",
        refresh: async () => {
          refreshCalls += 1
          await Promise.resolve()
          return {
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
          }
        },
      })

    await expect(Promise.all([rotate(), rotate()])).resolves.toEqual([
      { kind: "rotated" },
      { kind: "rotated" },
    ])
    expect(refreshCalls).toBe(1)
  })
})

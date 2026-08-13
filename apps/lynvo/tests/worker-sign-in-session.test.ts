// @vitest-environment edge-runtime

import { vi } from "vitest"

const mutationCalls: Array<Record<string, unknown>> = []
let currentSessionUser = {
  id: "user-a",
  username: "darshan",
  sessionId: "convex-session-id",
}

const encodeTokenSegment = (value: unknown) =>
  btoa(JSON.stringify(value)).replaceAll("=", "")

const convexAccessToken = `${encodeTokenSegment({ alg: "none" })}.${encodeTokenSegment({ sessionId: "convex-session-id" })}.signature`

const signInResult = {
  tokens: {
    token: convexAccessToken,
    refreshToken: "convex-refresh-token",
  },
}

vi.mock("virtual:react-router/server-build", () => ({}))
vi.mock("cloudflare:workers", () => ({
  DurableObject: class {},
}))
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    action = async (_reference: unknown, args: Record<string, unknown>) =>
      "refreshToken" in args
        ? {
            tokens: {
              token: "rotated-access-token",
              refreshToken: "rotated-refresh-token",
            },
          }
        : signInResult
    setAuth = () => undefined
    query = async () => currentSessionUser
    mutation = async (_reference: unknown, args: Record<string, unknown>) => {
      mutationCalls.push(args)
    }
  },
}))

describe("Worker sign-in session HTTP behavior", () => {
  it("returns only browser-safe state after creating an opaque HttpOnly session", async () => {
    const storedSessions: Array<unknown> = []
    const { default: worker } = await import("../workers/app")
    const response = await worker.fetch(
      new Request("https://lynvo.dg02002.workers.dev/api/auth/sign-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://lynvo.dg02002.workers.dev",
        },
        body: JSON.stringify({
          provider: "credentials",
          params: { flow: "signIn", username: "darshan", password: "secret" },
        }),
      }),
      {
        ENVIRONMENT: "production",
        VITE_CONVEX_URL: "https://convex.example",
        WORKER_AUTH_SESSION: {
          getByName: () => ({
            fetch: async (_url: string, init: RequestInit) => {
              storedSessions.push(JSON.parse(String(init.body)))
              return new Response(null, { status: 204 })
            },
          }),
        },
      } as Env,
      { waitUntil: () => undefined } as ExecutionContext
    )

    expect(response.status).toBe(200)
    expect(storedSessions).toHaveLength(1)
    expect(storedSessions[0]).toMatchObject({
      convexSessionId: "convex-session-id",
    })
    expect(mutationCalls).toContainEqual({
      workerSessionId: expect.any(String),
    })
    const cookie = response.headers.get("Set-Cookie") ?? ""
    expect(cookie).toContain("HttpOnly")
    expect(cookie).toContain("Secure")
    expect(cookie).toContain("SameSite=Lax")
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(cookie).not.toContain(convexAccessToken)
    expect(cookie).not.toContain("convex-refresh-token")
    await expect(response.json()).resolves.toEqual({ signingIn: true })
  })

  it("revokes an opaque session and expires its cookie", async () => {
    const revokedSessionIds: Array<string> = []
    const { default: worker } = await import("../workers/app")
    const response = await worker.fetch(
      new Request("https://lynvo.dg02002.workers.dev/api/auth/session", {
        method: "DELETE",
        headers: {
          Cookie: "__Host-lynvo-session=opaque-session-id",
          Origin: "https://lynvo.dg02002.workers.dev",
          "X-Lynvo-Expected-User-Id": "user-a",
          "X-Lynvo-Expected-Session-Id": "convex-session-id",
        },
      }),
      {
        ENVIRONMENT: "production",
        VITE_CONVEX_URL: "https://convex.example",
        WORKER_AUTH_SESSION: {
          getByName: (sessionId: string) => ({
            fetch: async (_url: string, init?: RequestInit) => {
              if (init?.method === "DELETE") {
                revokedSessionIds.push(sessionId)
                return new Response(null, { status: 204 })
              }
              return Response.json({
                convexSessionId: "convex-session-id",
                accessToken: convexAccessToken,
                refreshToken: "convex-refresh-token",
                createdAt: 1_000,
                expiresAt: 10_000,
              })
            },
          }),
        },
      } as Env,
      { waitUntil: () => undefined } as ExecutionContext
    )

    expect(response.status).toBe(204)
    expect(revokedSessionIds).toEqual(["opaque-session-id"])
    const cookie = response.headers.get("Set-Cookie") ?? ""
    expect(cookie).toContain("__Host-lynvo-session=")
    expect(cookie).toContain("HttpOnly")
    expect(cookie).toContain("Secure")
    expect(cookie).toContain("SameSite=Lax")
    expect(cookie).toContain("Max-Age=0")
  })

  it("does not revoke a newer session from a stale page", async () => {
    currentSessionUser = {
      id: "user-b",
      username: "newer",
      sessionId: "session-b",
    }
    const revokedSessionIds: string[] = []
    const { default: worker } = await import("../workers/app")
    const response = await worker.fetch(
      new Request("https://lynvo.dg02002.workers.dev/api/auth/session", {
        method: "DELETE",
        headers: {
          Cookie: "__Host-lynvo-session=newer-worker-session",
          Origin: "https://lynvo.dg02002.workers.dev",
          "X-Lynvo-Expected-User-Id": "user-a",
          "X-Lynvo-Expected-Session-Id": "session-a",
        },
      }),
      {
        ENVIRONMENT: "production",
        VITE_CONVEX_URL: "https://convex.example",
        WORKER_AUTH_SESSION: {
          getByName: (sessionId: string) => ({
            fetch: async (_url: string, init?: RequestInit) => {
              if (init?.method === "DELETE") {
                revokedSessionIds.push(sessionId)
                return new Response(null, { status: 204 })
              }
              return Response.json({
                convexSessionId: "session-b",
                accessToken: convexAccessToken,
                refreshToken: "convex-refresh-token",
                createdAt: 1_000,
                expiresAt: 10_000,
              })
            },
          }),
        },
      } as Env,
      { waitUntil: () => undefined } as ExecutionContext
    )

    expect(response.status).toBe(409)
    expect(revokedSessionIds).toEqual([])
  })

  it("does not expose a browser-callable manual refresh route", async () => {
    const { default: worker } = await import("../workers/app")
    const response = await worker.fetch(
      new Request(
        "https://lynvo.dg02002.workers.dev/api/auth/session/refresh",
        {
          method: "POST",
          headers: {
            Cookie: "__Host-lynvo-session=opaque-session-id",
            Origin: "https://lynvo.dg02002.workers.dev",
          },
        }
      ),
      {
        ENVIRONMENT: "production",
        VITE_CONVEX_URL: "https://convex.example",
        WORKER_AUTH_SESSION: {
          getByName: () => ({ fetch: async () => new Response(null) }),
        },
      } as Env,
      { waitUntil: () => undefined } as ExecutionContext
    )

    expect(response.status).toBe(404)
  })

  it("reports a signed-out session as a successful status check", async () => {
    const { default: worker } = await import("../workers/app")
    const response = await worker.fetch(
      new Request("https://lynvo.dg02002.workers.dev/api/auth/session/status"),
      {
        ENVIRONMENT: "production",
        VITE_CONVEX_URL: "https://convex.example",
      } as Env,
      { waitUntil: () => undefined } as ExecutionContext
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      status: "unauthenticated",
    })
  })
})

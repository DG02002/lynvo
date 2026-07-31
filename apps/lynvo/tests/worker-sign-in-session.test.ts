// @vitest-environment edge-runtime

import { vi } from "vitest"

const signInResult = {
  tokens: {
    token: "convex-access-token",
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
    mutation = async () => undefined
  },
}))

describe("Worker sign-in session HTTP behavior", () => {
  it("adds an opaque HttpOnly session while preserving the legacy client during widening", async () => {
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
    const cookie = response.headers.get("Set-Cookie") ?? ""
    expect(cookie).toContain("HttpOnly")
    expect(cookie).toContain("Secure")
    expect(cookie).toContain("SameSite=Lax")
    expect(cookie).not.toContain("convex-access-token")
    expect(cookie).not.toContain("convex-refresh-token")
    await expect(response.json()).resolves.toEqual(signInResult)
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
        },
      }),
      {
        ENVIRONMENT: "production",
        WORKER_AUTH_SESSION: {
          getByName: (sessionId: string) => ({
            fetch: async (_url: string, init: RequestInit) => {
              if (init.method === "DELETE") {
                revokedSessionIds.push(sessionId)
              }
              return new Response(null, { status: 204 })
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

  it("rotates server-side tokens without returning them to the browser", async () => {
    const storedRotations: Array<Record<string, unknown>> = []
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
          getByName: () => ({
            fetch: async (_url: string, init?: RequestInit) => {
              if (init?.method === "POST") {
                storedRotations.push(JSON.parse(String(init.body)))
                return new Response(null, { status: 204 })
              }
              return Response.json({
                accessToken: "old-access-token",
                refreshToken: "old-refresh-token",
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
    expect(await response.text()).toBe("")
    expect(storedRotations).toHaveLength(1)
    expect(storedRotations[0]).toMatchObject({
      accessToken: "rotated-access-token",
      refreshToken: "rotated-refresh-token",
      createdAt: 1_000,
      expiresAt: 10_000,
    })
  })
})

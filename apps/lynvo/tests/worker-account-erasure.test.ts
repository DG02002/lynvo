// @vitest-environment edge-runtime

import { vi } from "vitest"
import { csrfCookie } from "../app/lib/csrf"

vi.mock("virtual:react-router/server-build", () => ({}))
vi.mock("cloudflare:workers", () => ({ DurableObject: class {} }))
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    setAuth = () => undefined
    query = async () => ({
      id: "users:123",
      username: "darshan",
      sessionId: "authSessions:456",
      workerSessionIds: ["opaque-session-id"],
    })
    action = async () => ({ success: true })
  },
}))

describe("Worker account erasure HTTP behavior", () => {
  it("revokes the opaque Auth Session in the successful deletion response", async () => {
    const revokedSessionIds: string[] = []
    const csrfCookieHeader = await csrfCookie.serialize("test-csrf-token")
    const { default: worker } = await import("../workers/app")
    const response = await worker.fetch(
      new Request(
        "https://lynvo.dg02002.workers.dev/api/settings/security/account",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Cookie: `__Host-lynvo-session=opaque-session-id; ${csrfCookieHeader}`,
            Origin: "https://lynvo.dg02002.workers.dev",
            "X-CSRF-Token": "test-csrf-token",
          },
          body: JSON.stringify({ confirmUsername: "darshan" }),
        }
      ),
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
                convexSessionId: "authSessions:456",
                accessToken: "access-token",
                refreshToken: "refresh-token",
                createdAt: 1,
                expiresAt: Date.now() + 60_000,
              })
            },
          }),
        },
      } as Env,
      { waitUntil: () => undefined } as ExecutionContext
    )

    expect(response.status).toBe(200)
    expect(revokedSessionIds).toEqual(["opaque-session-id"])
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0")
    await expect(response.json()).resolves.toEqual({ success: true })
  })
})

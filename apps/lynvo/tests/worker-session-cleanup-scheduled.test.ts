// @vitest-environment edge-runtime

import { expect, vi } from "vitest"

const { pendingSessionIds, mutationCalls } = vi.hoisted(() => ({
  pendingSessionIds: new Set<string>(),
  mutationCalls: [] as Array<Record<string, unknown>>,
}))

const encodeTokenSegment = (value: unknown) =>
  btoa(JSON.stringify(value)).replaceAll("=", "")

const convexAccessToken = `${encodeTokenSegment({ alg: "none" })}.${encodeTokenSegment({ sessionId: "convex-session-id" })}.signature`

vi.mock("virtual:react-router/server-build", () => ({}))
vi.mock("cloudflare:workers", () => ({ DurableObject: class {} }))
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    action = async () => ({
      tokens: {
        token: convexAccessToken,
        refreshToken: "convex-refresh-token",
      },
    })
    setAuth = () => undefined
    query = async (reference: unknown) => {
      const { getFunctionName } = await import("convex/server")
      return getFunctionName(reference) === "sessionCleanup:listPending"
        ? [...pendingSessionIds].map((workerSessionId) => ({ workerSessionId }))
        : []
    }
    mutation = async (_reference: unknown, args: Record<string, unknown>) => {
      mutationCalls.push(args)
      if ("workerSessionIds" in args) {
        for (const workerSessionId of args.workerSessionIds as string[]) {
          pendingSessionIds.add(workerSessionId)
        }
        return { success: true }
      }
      if ("serviceToken" in args && "workerSessionId" in args) {
        pendingSessionIds.delete(String(args.workerSessionId))
        return { success: true }
      }
      if ("workerSessionId" in args) {
        throw new Error("Convex session linking failed")
      }
      return { success: true }
    }
  },
}))

describe("scheduled Worker Auth Session cleanup", () => {
  it("recovers failed establishment compensation through a fresh scheduled entry", async () => {
    pendingSessionIds.clear()
    mutationCalls.length = 0
    let shouldFailRevocation = true
    const revokedSessionIds: string[] = []
    const environment = {
      ENVIRONMENT: "production",
      VITE_CONVEX_URL: "https://convex.example",
      AUTH_GATEWAY_SECRET: "test-gateway-secret",
      WORKER_AUTH_SESSION: {
        getByName: (sessionId: string) => ({
          fetch: async (_url: string, init?: RequestInit) => {
            if (init?.method === "DELETE") {
              if (shouldFailRevocation) {
                shouldFailRevocation = false
                return new Response(null, { status: 503 })
              }
              revokedSessionIds.push(sessionId)
              return new Response(null, { status: 204 })
            }
            return new Response(null, { status: 204 })
          },
        }),
      },
    } as Env
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
      environment,
      { waitUntil: () => undefined } as ExecutionContext
    )

    expect(response.status).toBe(503)
    expect(pendingSessionIds.size).toBe(1)
    expect(revokedSessionIds).toEqual([])

    await worker.scheduled(
      { cron: "*/5 * * * *", scheduledTime: Date.now() } as ScheduledController,
      environment,
      { waitUntil: () => undefined } as ExecutionContext
    )

    expect(revokedSessionIds).toHaveLength(1)
    expect(pendingSessionIds.size).toBe(0)
    expect(mutationCalls).toContainEqual({
      serviceToken: expect.any(String),
      workerSessionIds: revokedSessionIds,
      issuanceGeneration: undefined,
    })
  })
})

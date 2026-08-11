import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  mutation: vi.fn(),
  query: vi.fn(),
}))

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    action = mocks.action
    mutation = mocks.mutation
    query = mocks.query
    setAuth = vi.fn()
  },
}))

const createAccessToken = (sessionId: string) => {
  const payload = btoa(JSON.stringify({ sessionId }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")
  return `header.${payload}.signature`
}

describe("Worker device exchange recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("reissues the same cookie without creating another Convex session", async () => {
    const storedSessions = new Map<string, unknown>()
    const accessToken = createAccessToken("convex-session-one")
    mocks.action.mockResolvedValue({
      tokens: { token: accessToken, refreshToken: "refresh-token-one" },
    })
    mocks.mutation.mockResolvedValue({ success: true })
    mocks.query.mockResolvedValue("completed")
    const environment = {
      VITE_CONVEX_URL: "https://test.convex.cloud",
      AUTH_GATEWAY_SECRET: "gateway-secret",
      WORKER_AUTH_SESSION: {
        getByName: (sessionId: string) => ({
          fetch: async (_url: string, init?: RequestInit) => {
            if (init?.method === "DELETE") {
              storedSessions.delete(sessionId)
              return new Response(null, { status: 204 })
            }
            if (init?.method === "POST") {
              if (storedSessions.has(sessionId)) {
                return new Response(null, { status: 409 })
              }
              const value: unknown = JSON.parse(String(init.body))
              storedSessions.set(sessionId, value)
              return new Response(null, { status: 204 })
            }
            const session = storedSessions.get(sessionId)
            return session
              ? Response.json(session)
              : new Response(null, { status: 404 })
          },
        }),
      },
    }
    const { createWorkerAuthenticationFlow } =
      await import("../workers/authentication-flow")
    const flow = createWorkerAuthenticationFlow(environment)
    const input = {
      provider: "credentials" as const,
      params: {
        flow: "device",
        code: "ABCD-EFGH",
        pollSecret: "poll-secret",
        exchangeAttemptId: "exchange-one",
      },
    }

    const first = await flow.signIn(input)
    const recovered = await flow.signIn(input)

    expect(first).toMatchObject({ kind: "completed", hasTokens: true })
    expect(recovered).toEqual(first)
    expect(mocks.action).toHaveBeenCalledOnce()
    expect(storedSessions).toHaveLength(1)
    expect(mocks.query).toHaveBeenCalledOnce()
  })

  it("resumes an incomplete Worker exchange without creating a new session", async () => {
    const storedSessions = new Map<string, unknown>([
      [
        "exchange-one",
        {
          convexSessionId: "stale-session",
          accessToken: createAccessToken("stale-session"),
          refreshToken: "stale-refresh",
          createdAt: 1,
          expiresAt: Date.now() + 60_000,
        },
      ],
    ])
    mocks.query.mockResolvedValue("resumable")
    mocks.mutation.mockResolvedValue({ success: true })
    const environment = {
      VITE_CONVEX_URL: "https://test.convex.cloud",
      AUTH_GATEWAY_SECRET: "gateway-secret",
      WORKER_AUTH_SESSION: {
        getByName: (sessionId: string) => ({
          fetch: async (_url: string, init?: RequestInit) => {
            if (init?.method === "DELETE") {
              storedSessions.delete(sessionId)
              return new Response(null, { status: 204 })
            }
            const session = storedSessions.get(sessionId)
            return session
              ? Response.json(session)
              : new Response(null, { status: 404 })
          },
        }),
      },
    }
    const { createWorkerAuthenticationFlow } =
      await import("../workers/authentication-flow")

    await expect(
      createWorkerAuthenticationFlow(environment).signIn({
        provider: "credentials",
        params: {
          flow: "device",
          code: "ABCD-EFGH",
          pollSecret: "poll-secret",
          exchangeAttemptId: "exchange-one",
        },
      })
    ).resolves.toMatchObject({ kind: "completed", hasTokens: true })
    expect(mocks.action).not.toHaveBeenCalled()
    expect(mocks.mutation).toHaveBeenCalledTimes(2)
    expect(storedSessions).toHaveLength(1)
  })
})

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
    mocks.mutation.mockResolvedValue("current")
    mocks.query.mockResolvedValue("completed")
    const environment = {
      VITE_CONVEX_URL: "https://test.convex.cloud",
      AUTH_GATEWAY_SECRET: "gateway-secret",
      WORKER_AUTH_SESSION: {
        getByName: (sessionId: string) => ({
          fetch: async (url: string, init?: RequestInit) => {
            if (init?.method === "DELETE") {
              storedSessions.delete(sessionId)
              return new Response(null, { status: 204 })
            }
            if (init?.method === "POST") {
              if (url.endsWith("/session/issuance")) {
                return Response.json({ generation: 1 }, { status: 201 })
              }
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
          issuanceGeneration: 1,
        },
      ],
    ])
    mocks.query.mockResolvedValue("resumable")
    mocks.mutation.mockResolvedValue("current")
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

  it("allows only one concurrent caller to issue a device session", async () => {
    const storedSessions = new Map<string, unknown>()
    let issuanceActive = false
    let releaseSignIn: (() => void) | undefined
    const signInBarrier = new Promise<void>((resolve) => {
      releaseSignIn = resolve
    })
    mocks.action.mockImplementation(async () => {
      await signInBarrier
      return {
        tokens: {
          token: createAccessToken("convex-session-one"),
          refreshToken: "refresh-token-one",
        },
      }
    })
    mocks.mutation.mockResolvedValue("current")
    const environment = {
      VITE_CONVEX_URL: "https://test.convex.cloud",
      AUTH_GATEWAY_SECRET: "gateway-secret",
      WORKER_AUTH_SESSION: {
        getByName: (sessionId: string) => ({
          fetch: async (url: string, init?: RequestInit) => {
            if (url.endsWith("/session/issuance")) {
              if (storedSessions.has(sessionId)) {
                return new Response(null, { status: 200 })
              }
              if (issuanceActive) {
                return new Response(null, { status: 409 })
              }
              issuanceActive = true
              return Response.json({ generation: 1 }, { status: 201 })
            }
            if (init?.method === "POST") {
              storedSessions.set(sessionId, JSON.parse(String(init.body)))
              issuanceActive = false
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

    const winner = flow.signIn(input)
    await vi.waitFor(() => expect(mocks.action).toHaveBeenCalledOnce())
    const concurrent = await flow.signIn(input)
    releaseSignIn?.()

    await expect(winner).resolves.toMatchObject({
      kind: "completed",
      hasTokens: true,
    })
    expect(concurrent).toEqual({ kind: "unavailable" })
    expect(mocks.action).toHaveBeenCalledOnce()
    expect(storedSessions).toHaveLength(1)
    expect(mocks.mutation).toHaveBeenCalledTimes(3)
  })
})

describe("Worker credentials outcomes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns invalid credentials when the provider creates no session", async () => {
    mocks.action.mockResolvedValue({})
    const { createWorkerAuthenticationFlow } =
      await import("../workers/authentication-flow")
    const flow = createWorkerAuthenticationFlow({
      VITE_CONVEX_URL: "https://test.convex.cloud",
      AUTH_GATEWAY_SECRET: "gateway-secret",
      WORKER_AUTH_SESSION: {
        getByName: () => ({ fetch: vi.fn() }),
      },
    } as Env)

    await expect(
      flow.signIn({
        provider: "credentials",
        params: {
          flow: "signIn",
          username: "missing-user",
          password: "wrong-password",
        },
      })
    ).resolves.toEqual({ kind: "invalid-credentials" })
  })

  it.each(["InvalidSecret", "dependency wording changed"])(
    "returns unavailable without classifying the dependency message %s",
    async (message) => {
      mocks.action.mockRejectedValue(new Error(message))
      const { createWorkerAuthenticationFlow } =
        await import("../workers/authentication-flow")
      const flow = createWorkerAuthenticationFlow({
        VITE_CONVEX_URL: "https://test.convex.cloud",
        AUTH_GATEWAY_SECRET: "gateway-secret",
        WORKER_AUTH_SESSION: {
          getByName: () => ({ fetch: vi.fn() }),
        },
      } as Env)

      await expect(
        flow.signIn({
          provider: "credentials",
          params: {
            flow: "signIn",
            username: "user-one",
            password: "password",
          },
        })
      ).resolves.toEqual({ kind: "unavailable" })
    }
  )
})

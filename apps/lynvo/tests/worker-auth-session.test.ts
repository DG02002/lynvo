import { describe, expect, it } from "vitest"
import { WorkerAuthSession } from "../workers/worker-auth-session"

class MemorySessionStorage {
  private readonly values = new Map<string, unknown>()

  get = async <Value>(key: string): Promise<Value | undefined> =>
    this.values.get(key) as Value | undefined

  put = async (key: string, value: unknown): Promise<void> => {
    this.values.set(key, value)
  }

  delete = async (key: string): Promise<boolean> => this.values.delete(key)

  inspect = (key: string): unknown => this.values.get(key)
}

const TEST_SESSION_KEY = btoa("abcdef0123456789abcdef0123456789")

const createSession = (
  environment = { AUTH_SESSION_MASTER_KEY: TEST_SESSION_KEY }
) => {
  const storage = new MemorySessionStorage()
  return {
    session: new WorkerAuthSession(
      {
        storage,
        id: { toString: () => "session-object-1" },
      } as DurableObjectState,
      environment as Env
    ),
    storage,
  }
}

describe("Worker authentication session HTTP behavior", () => {
  it("stores server-only credentials and returns the authenticated session", async () => {
    const { session, storage } = createSession()
    const createResponse = await session.fetch(
      new Request("https://session.internal/session", {
        method: "POST",
        body: JSON.stringify({
          accessToken: "access-token",
          refreshToken: "refresh-token",
          createdAt: 1_000,
          expiresAt: 2_000,
        }),
      })
    )
    expect(createResponse.status).toBe(204)
    expect(JSON.stringify(storage.inspect("session"))).not.toContain(
      "access-token"
    )
    expect(JSON.stringify(storage.inspect("session"))).not.toContain(
      "refresh-token"
    )

    const response = await session.fetch(
      new Request("https://session.internal/session?nowMs=1500")
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      createdAt: 1_000,
      expiresAt: 2_000,
    })
  })

  it("expires and revokes sessions through HTTP behavior", async () => {
    const { session } = createSession()
    await session.fetch(
      new Request("https://session.internal/session", {
        method: "POST",
        body: JSON.stringify({
          accessToken: "access-token",
          refreshToken: "refresh-token",
          createdAt: 1_000,
          expiresAt: 2_000,
        }),
      })
    )

    expect(
      (
        await session.fetch(
          new Request("https://session.internal/session?nowMs=2000")
        )
      ).status
    ).toBe(401)

    await session.fetch(
      new Request("https://session.internal/session", { method: "DELETE" })
    )
    expect(
      (
        await session.fetch(
          new Request("https://session.internal/session?nowMs=1500")
        )
      ).status
    ).toBe(404)
  })

  it("fails closed when session encryption is unavailable", async () => {
    const { session } = createSession({ AUTH_SESSION_MASTER_KEY: "" })
    const response = await session.fetch(
      new Request("https://session.internal/session", {
        method: "POST",
        body: JSON.stringify({
          accessToken: "access-token",
          refreshToken: "refresh-token",
          createdAt: 1_000,
          expiresAt: 2_000,
        }),
      })
    )
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: "Session service is unavailable.",
    })
  })

  it("extends idle expiry on activity without exceeding absolute expiry", async () => {
    const { session } = createSession()
    await session.fetch(
      new Request("https://session.internal/session", {
        method: "POST",
        body: JSON.stringify({
          accessToken: "access-token",
          refreshToken: "refresh-token",
          createdAt: 1_000,
          expiresAt: 10_000,
          idleTimeoutMs: 1_000,
        }),
      })
    )

    expect(
      (
        await session.fetch(
          new Request("https://session.internal/session?nowMs=1500")
        )
      ).status
    ).toBe(200)
    expect(
      (
        await session.fetch(
          new Request("https://session.internal/session?nowMs=2499")
        )
      ).status
    ).toBe(200)
    expect(
      (
        await session.fetch(
          new Request("https://session.internal/session?nowMs=3499")
        )
      ).status
    ).toBe(401)
  })
})

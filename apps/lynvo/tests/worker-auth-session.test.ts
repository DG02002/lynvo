import { describe, expect, it } from "vitest"
import { WorkerAuthSession } from "../workers/worker-auth-session"
import {
  createAuthSessionModule,
  SESSION_ABSOLUTE_LIFETIME_MS,
  SESSION_IDLE_TIMEOUT_MS,
} from "../workers/auth-session"

class MemorySessionStorage {
  private readonly values = new Map<string, unknown>()
  private alarm: number | null = null
  private transactionPause:
    | {
        readonly entered: () => void
        readonly wait: Promise<void>
        remainingTransactions: number
      }
    | undefined

  get = async <Value>(key: string): Promise<Value | undefined> =>
    this.values.get(key) as Value | undefined

  put = async (key: string, value: unknown): Promise<void> => {
    this.values.set(key, value)
  }

  delete = async (key: string | string[]): Promise<boolean | number> => {
    if (typeof key === "string") {
      return this.values.delete(key)
    }
    return key.reduce(
      (deleted, innerKey) => deleted + Number(this.values.delete(innerKey)),
      0
    )
  }

  transaction = async <Value>(
    closure: (storage: DurableObjectTransaction) => Promise<Value>
  ): Promise<Value> => {
    const pause = this.transactionPause
    if (pause) {
      if (pause.remainingTransactions > 0) {
        pause.remainingTransactions -= 1
        return await closure(this as unknown as DurableObjectTransaction)
      }
      this.transactionPause = undefined
      pause.entered()
      await pause.wait
    }
    return await closure(this as unknown as DurableObjectTransaction)
  }

  getAlarm = async (): Promise<number | null> => this.alarm

  setAlarm = async (scheduledTime: number | Date): Promise<void> => {
    this.alarm =
      typeof scheduledTime === "number"
        ? scheduledTime
        : scheduledTime.getTime()
  }

  pauseNextTransaction = (remainingTransactions = 0) => {
    let markEntered: (() => void) | undefined
    let release: (() => void) | undefined
    const entered = new Promise<void>((resolve) => {
      markEntered = resolve
    })
    const wait = new Promise<void>((resolve) => {
      release = resolve
    })
    this.transactionPause = {
      entered: () => markEntered?.(),
      wait,
      remainingTransactions,
    }
    return { entered, release: () => release?.() }
  }

  inspect = (key: string): unknown => this.values.get(key)
}

const TEST_SESSION_KEY = btoa("abcdef0123456789abcdef0123456789")

const createSession = (
  environment = { AUTH_SESSION_ENCRYPTION_KEY: TEST_SESSION_KEY }
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
  it("fences delayed issuers with a renewable Durable Object generation", async () => {
    const { session } = createSession()
    const beginIssuance = (nowMs: number) =>
      session.fetch(
        new Request("https://session.internal/session/issuance", {
          method: "POST",
          body: JSON.stringify({
            nowMs,
            expiresAt: nowMs + 1_000,
          }),
        })
      )
    const createForGeneration = (generation: number) =>
      session.fetch(
        new Request("https://session.internal/session", {
          method: "POST",
          body: JSON.stringify({
            convexSessionId: "convex-session-id",
            accessToken: `${generation}-access`,
            refreshToken: `${generation}-refresh`,
            createdAt: 2_000,
            expiresAt: 4_000,
            issuanceGeneration: generation,
          }),
        })
      )

    const first = await beginIssuance(1_000)
    expect(first.status).toBe(201)
    await expect(first.json()).resolves.toEqual({ generation: 1 })
    expect((await beginIssuance(1_500)).status).toBe(409)
    const second = await beginIssuance(2_001)
    expect(second.status).toBe(201)
    await expect(second.json()).resolves.toEqual({ generation: 2 })
    expect((await createForGeneration(1)).status).toBe(409)
    expect((await createForGeneration(2)).status).toBe(204)
    expect((await beginIssuance(2_002)).status).toBe(200)
  })

  it("retains the issuance high-water mark when an unfinished session is deleted", async () => {
    const { session } = createSession()
    const beginIssuance = (nowMs: number) =>
      session.fetch(
        new Request("https://session.internal/session/issuance", {
          method: "POST",
          body: JSON.stringify({
            nowMs,
            expiresAt: nowMs + 1_000,
          }),
        })
      )

    const first = await beginIssuance(1_000)
    await expect(first.json()).resolves.toEqual({ generation: 1 })
    expect(
      (
        await session.fetch(
          new Request("https://session.internal/session", { method: "DELETE" })
        )
      ).status
    ).toBe(204)

    const second = await beginIssuance(1_001)
    expect(second.status).toBe(201)
    await expect(second.json()).resolves.toEqual({ generation: 2 })
  })

  it("does not let delayed generation cleanup delete its replacement", async () => {
    const { session } = createSession()
    const beginIssuance = async (nowMs: number) => {
      const response = await session.fetch(
        new Request("https://session.internal/session/issuance", {
          method: "POST",
          body: JSON.stringify({
            nowMs,
            expiresAt: nowMs + 1_000,
          }),
        })
      )
      return (await response.json()) as { generation: number }
    }
    const createForGeneration = (generation: number) =>
      session.fetch(
        new Request("https://session.internal/session", {
          method: "POST",
          body: JSON.stringify({
            convexSessionId: `convex-session-${generation}`,
            accessToken: `access-${generation}`,
            refreshToken: `refresh-${generation}`,
            createdAt: 1_000,
            expiresAt: 10_000,
            issuanceGeneration: generation,
          }),
        })
      )

    expect((await beginIssuance(1_000)).generation).toBe(1)
    expect((await createForGeneration(1)).status).toBe(204)
    expect(
      (
        await session.fetch(
          new Request("https://session.internal/session?issuanceGeneration=1", {
            method: "DELETE",
          })
        )
      ).status
    ).toBe(204)
    expect((await beginIssuance(1_001)).generation).toBe(2)
    expect((await createForGeneration(2)).status).toBe(204)

    expect(
      (
        await session.fetch(
          new Request("https://session.internal/session?issuanceGeneration=1", {
            method: "DELETE",
          })
        )
      ).status
    ).toBe(204)
    const current = await session.fetch(
      new Request("https://session.internal/session?nowMs=1500")
    )
    expect(current.status).toBe(200)
    await expect(current.json()).resolves.toMatchObject({
      convexSessionId: "convex-session-2",
      issuanceGeneration: 2,
    })
  })

  it("creates, rotates, and reads through the real Durable Object", async () => {
    const { session, storage } = createSession()
    const nowMs = Date.now()
    const authSession = createAuthSessionModule({
      getByName: () => ({
        fetch: async (url: string, init?: RequestInit) =>
          await session.fetch(new Request(url, init)),
      }),
    })
    await expect(
      authSession.create({
        sessionId: "session-object-1",
        convexSessionId: "convex-session-one",
        accessToken: "access-token-one",
        refreshToken: "refresh-token-one",
        nowMs,
      })
    ).resolves.toMatchObject({ kind: "created" })
    const storedBeforeRotation = storage.inspect("session")

    await expect(
      Promise.all([
        authSession.rotate({
          sessionId: "session-object-1",
          refresh: async () => ({
            accessToken: "access-token-two",
            refreshToken: "refresh-token-two",
          }),
        }),
        authSession.rotate({
          sessionId: "session-object-1",
          refresh: async () => ({
            accessToken: "access-token-three",
            refreshToken: "refresh-token-three",
          }),
        }),
      ])
    ).resolves.toEqual([{ kind: "rotated" }, { kind: "rotated" }])

    await expect(authSession.read("session-object-1")).resolves.toMatchObject({
      kind: "active",
      session: {
        convexSessionId: "convex-session-one",
        accessToken: "access-token-two",
        refreshToken: "refresh-token-two",
        createdAt: nowMs,
      },
    })
    expect(storage.inspect("session")).toMatchObject({
      createdAt: nowMs,
      expiresAt: nowMs + SESSION_ABSOLUTE_LIFETIME_MS,
      idleTimeoutMs: SESSION_IDLE_TIMEOUT_MS,
    })
    expect(storedBeforeRotation).toMatchObject({
      createdAt: nowMs,
      expiresAt: nowMs + SESSION_ABSOLUTE_LIFETIME_MS,
      idleTimeoutMs: SESSION_IDLE_TIMEOUT_MS,
    })

    const conflictingCreate = await session.fetch(
      new Request("https://session.internal/session", {
        method: "POST",
        body: JSON.stringify({
          convexSessionId: "convex-session-two",
          accessToken: "other-access-token",
          refreshToken: "other-refresh-token",
          createdAt: 2_000,
          expiresAt: 3_000,
        }),
      })
    )
    expect(conflictingCreate.status).toBe(409)
  })

  it("stores server-only credentials and returns the authenticated session", async () => {
    const { session, storage } = createSession()
    const createResponse = await session.fetch(
      new Request("https://session.internal/session", {
        method: "POST",
        body: JSON.stringify({
          convexSessionId: "convex-session-id",
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
      convexSessionId: "convex-session-id",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      createdAt: 1_000,
      expiresAt: 2_000,
    })
  })

  it("never overwrites an established exchange session", async () => {
    const { session } = createSession()
    const create = (convexSessionId: string) =>
      session.fetch(
        new Request("https://session.internal/session", {
          method: "POST",
          body: JSON.stringify({
            convexSessionId,
            accessToken: `${convexSessionId}-access`,
            refreshToken: `${convexSessionId}-refresh`,
            createdAt: 1_000,
            expiresAt: 2_000,
          }),
        })
      )

    expect((await create("convex-session-one")).status).toBe(204)
    expect((await create("convex-session-two")).status).toBe(409)
    const response = await session.fetch(
      new Request("https://session.internal/session?nowMs=1500")
    )
    await expect(response.json()).resolves.toMatchObject({
      convexSessionId: "convex-session-one",
    })
  })

  it("expires and revokes sessions through HTTP behavior", async () => {
    const { session } = createSession()
    await session.fetch(
      new Request("https://session.internal/session", {
        method: "POST",
        body: JSON.stringify({
          convexSessionId: "convex-session-id",
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

  it("does not return a deleted session after the object is reused", async () => {
    const { session, storage } = createSession()
    await session.fetch(
      new Request("https://session.internal/session", {
        method: "POST",
        body: JSON.stringify({
          convexSessionId: "convex-session-id",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          createdAt: 1_000,
          expiresAt: 10_000,
        }),
      })
    )
    const transactionPause = storage.pauseNextTransaction(1)
    const read = session.fetch(
      new Request("https://session.internal/session?nowMs=1500")
    )
    await transactionPause.entered

    await session.fetch(
      new Request("https://session.internal/session", { method: "DELETE" })
    )
    await session.fetch(
      new Request("https://session.internal/session", {
        method: "POST",
        body: JSON.stringify({
          convexSessionId: "replacement-convex-session-id",
          accessToken: "replacement-access-token",
          refreshToken: "replacement-refresh-token",
          createdAt: 1_400,
          expiresAt: 10_000,
        }),
      })
    )
    transactionPause.release()

    await expect(read).resolves.toMatchObject({ status: 409 })
    const current = await session.fetch(
      new Request("https://session.internal/session?nowMs=1500")
    )
    expect(current.status).toBe(200)
    await expect(current.json()).resolves.toMatchObject({
      convexSessionId: "replacement-convex-session-id",
      accessToken: "replacement-access-token",
      refreshToken: "replacement-refresh-token",
    })
    expect(storage.inspect("session")).toBeDefined()
  })

  it("does not shorten the idle deadline when reads finish out of order", async () => {
    const { session, storage } = createSession()
    await session.fetch(
      new Request("https://session.internal/session", {
        method: "POST",
        body: JSON.stringify({
          convexSessionId: "convex-session-id",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          createdAt: 1_000,
          expiresAt: 10_000,
          idleTimeoutMs: 1_000,
        }),
      })
    )
    const transactionPause = storage.pauseNextTransaction(1)
    const olderRead = session.fetch(
      new Request("https://session.internal/session?nowMs=1100")
    )
    await transactionPause.entered

    await expect(
      session.fetch(new Request("https://session.internal/session?nowMs=1900"))
    ).resolves.toMatchObject({ status: 200 })
    transactionPause.release()

    await expect(olderRead).resolves.toMatchObject({ status: 200 })
    expect(storage.inspect("session")).toMatchObject({ idleExpiresAt: 2_900 })
  })

  it("does not overwrite a replacement session with a stale token rotation", async () => {
    const { session, storage } = createSession()
    await session.fetch(
      new Request("https://session.internal/session", {
        method: "POST",
        body: JSON.stringify({
          convexSessionId: "convex-session-id",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          createdAt: 1_000,
          expiresAt: 10_000,
        }),
      })
    )
    const transactionPause = storage.pauseNextTransaction()
    const rotation = session.fetch(
      new Request("https://session.internal/session/tokens", {
        method: "PUT",
        body: JSON.stringify({
          convexSessionId: "convex-session-id",
          accessToken: "rotated-access-token",
          refreshToken: "rotated-refresh-token",
        }),
      })
    )
    await transactionPause.entered

    await session.fetch(
      new Request("https://session.internal/session", { method: "DELETE" })
    )
    await session.fetch(
      new Request("https://session.internal/session", {
        method: "POST",
        body: JSON.stringify({
          convexSessionId: "replacement-convex-session-id",
          accessToken: "replacement-access-token",
          refreshToken: "replacement-refresh-token",
          createdAt: 1_400,
          expiresAt: 10_000,
        }),
      })
    )
    transactionPause.release()

    await expect(rotation).resolves.toMatchObject({ status: 409 })
    const current = await session.fetch(
      new Request("https://session.internal/session?nowMs=1500")
    )
    expect(current.status).toBe(200)
    await expect(current.json()).resolves.toMatchObject({
      convexSessionId: "replacement-convex-session-id",
      accessToken: "replacement-access-token",
      refreshToken: "replacement-refresh-token",
    })
    expect(storage.inspect("session")).toBeDefined()
  })

  it("fails closed when session encryption is unavailable", async () => {
    const { session } = createSession({ AUTH_SESSION_ENCRYPTION_KEY: "" })
    const response = await session.fetch(
      new Request("https://session.internal/session", {
        method: "POST",
        body: JSON.stringify({
          convexSessionId: "convex-session-id",
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
          convexSessionId: "convex-session-id",
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

  it("validates realtime authority without extending idle expiry", async () => {
    const { session } = createSession()
    await session.fetch(
      new Request("https://session.internal/session", {
        method: "POST",
        body: JSON.stringify({
          convexSessionId: "convex-session-id",
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
          new Request("https://session.internal/session?nowMs=1500", {
            method: "HEAD",
          })
        )
      ).status
    ).toBe(204)
    expect(
      (
        await session.fetch(
          new Request("https://session.internal/session?nowMs=2000", {
            method: "HEAD",
          })
        )
      ).status
    ).toBe(401)
  })

  it("advances activity touch metadata only after confirmation", async () => {
    const { session } = createSession()
    await session.fetch(
      new Request("https://session.internal/session", {
        method: "POST",
        body: JSON.stringify({
          convexSessionId: "convex-session-id",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          createdAt: 1_000,
          expiresAt: 10_000,
        }),
      })
    )

    const initialStatus = await session.fetch(
      new Request("https://session.internal/activity-touch")
    )
    await expect(initialStatus.json()).resolves.toEqual({
      lastActivityTouchAt: 1_000,
    })
    expect(
      (
        await session.fetch(
          new Request("https://session.internal/activity-touch", {
            method: "PUT",
            body: JSON.stringify({ touchedAt: 2_000 }),
          })
        )
      ).status
    ).toBe(204)
    const updatedStatus = await session.fetch(
      new Request("https://session.internal/activity-touch")
    )
    await expect(updatedStatus.json()).resolves.toEqual({
      lastActivityTouchAt: 2_000,
    })
  })
})

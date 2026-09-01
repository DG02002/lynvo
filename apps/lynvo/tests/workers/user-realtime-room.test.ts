import { describe, expect, it, vi } from "vitest"

declare global {
  interface TestRealtimeAttachment {
    readonly sessionId: string
    readonly receiverId: string
    readonly deviceName: string
    readonly connectedAt: number
  }
}

const runAlarm = async <Database>(
  database: Database,
  attachment: TestRealtimeAttachment = {
    sessionId: "session-1",
    receiverId: "receiver-1",
    deviceName: "Living room",
    connectedAt: 1,
  }
) => {
  const { UserRealtimeRoom } = await import("../../workers/app")
  const close = vi.fn()
  const socket = {
    close,
    deserializeAttachment: () => attachment,
  }
  const setAlarm = vi.fn(async () => undefined)
  // SAFETY: Object.create preserves the class prototype; the test injects the ctx and env fields used by alarm.
  const room = Object.create(UserRealtimeRoom.prototype) as UserRealtimeRoom
  Reflect.set(room, "ctx", {
    getWebSockets: () => [socket],
    storage: {
      get: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
      setAlarm,
    },
  })
  Reflect.set(room, "env", { DB: database })

  await room.alarm()
  return { close, setAlarm }
}

const activeSessionDatabase = (activeSessionIds: string[]) => ({
  prepare: (sql: string) => ({
    bind: (...args: unknown[]) => ({
      first: async () =>
        sql.includes("FROM sessions") &&
        activeSessionIds.includes(String(args[0]))
          ? { id: args[0] }
          : null,
    }),
  }),
})

describe("UserRealtimeRoom session revalidation", () => {
  it("keeps the socket connected while the D1 session is active", async () => {
    const database = activeSessionDatabase(["session-1"])
    const { close, setAlarm } = await runAlarm(database)

    expect(close).not.toHaveBeenCalled()
    expect(setAlarm).toHaveBeenCalledOnce()
  })

  it("authoritatively revokes the socket once the D1 session is gone", async () => {
    const database = activeSessionDatabase([])
    const { close, setAlarm } = await runAlarm(database)

    expect(close).toHaveBeenCalledWith(4001, "Session expired")
    expect(setAlarm).toHaveBeenCalledOnce()
  })

  it("keeps sockets open when the database binding is absent", async () => {
    const { close, setAlarm } = await runAlarm(undefined)

    expect(close).not.toHaveBeenCalled()
    expect(setAlarm).toHaveBeenCalledOnce()
  })

  it("keeps other sockets open when one attachment is unreadable", async () => {
    const { UserRealtimeRoom } = await import("../../workers/app")
    const close = vi.fn()
    const setAlarm = vi.fn(async () => undefined)
    // SAFETY: Object.create preserves the class prototype; the test injects the ctx and env fields used by alarm.
    const room = Object.create(UserRealtimeRoom.prototype) as UserRealtimeRoom
    Reflect.set(room, "ctx", {
      getWebSockets: () => [{ close, deserializeAttachment: () => null }],
      storage: {
        get: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined),
        setAlarm,
      },
    })
    Reflect.set(room, "env", { DB: activeSessionDatabase([]) })

    await room.alarm()

    expect(close).toHaveBeenCalledWith(4001, "Session invalid")
    expect(setAlarm).toHaveBeenCalledOnce()
  })
})

describe("UserRealtimeRoom close handling", () => {
  it.each([1005, 1006])(
    "does not echo reserved close code %s",
    async (code) => {
      const { UserRealtimeRoom } = await import("../../workers/app")
      const close = vi.fn(() => {
        throw new Error(`Invalid WebSocket close code: ${code}`)
      })
      // SAFETY: The callback only uses WebSocket.close; this test double supplies that method.
      const socket = { close } as WebSocket
      // SAFETY: Object.create preserves the class prototype; the handler does not use instance state.
      const room = Object.create(UserRealtimeRoom.prototype) as UserRealtimeRoom

      expect(() => room.webSocketClose(socket, code, "")).not.toThrow()
      expect(close).not.toHaveBeenCalled()
    }
  )
})

describe("UserRealtimeRoom inbox notification", () => {
  it.each([0, 2])("reports delivery to %s matching sockets", async (count) => {
    const { UserRealtimeRoom } = await import("../../workers/app")
    const send = vi.fn()
    // SAFETY: Object.create preserves the class prototype; the test injects the ctx field used by fetch.
    const room = Object.create(UserRealtimeRoom.prototype) as UserRealtimeRoom
    Reflect.set(room, "ctx", {
      getWebSockets: () => Array.from({ length: count }, () => ({ send })),
    })

    const response = await room.fetch(
      new Request("https://realtime.internal/notify-inbox", {
        method: "POST",
        body: JSON.stringify({ receiverId: "receiver-one" }),
      })
    )

    await expect(response.json()).resolves.toEqual({
      deliveredSocketCount: count,
    })
    expect(send).toHaveBeenCalledTimes(count)
  })
})

describe("UserRealtimeRoom data-changed broadcast", () => {
  it.each([0, 3])("fans the version out to %s sockets", async (count) => {
    const { UserRealtimeRoom } = await import("../../workers/app")
    const send = vi.fn()
    // SAFETY: Object.create preserves the class prototype; the test injects the ctx field used by fetch.
    const room = Object.create(UserRealtimeRoom.prototype) as UserRealtimeRoom
    Reflect.set(room, "ctx", {
      getWebSockets: () => Array.from({ length: count }, () => ({ send })),
    })

    const response = await room.fetch(
      new Request("https://realtime.internal/notify-data-changed", {
        method: "POST",
        body: JSON.stringify({ version: 42 }),
      })
    )

    await expect(response.json()).resolves.toEqual({
      deliveredSocketCount: count,
    })
    for (const index of Array.from(
      { length: count },
      (_, socketIndex) => socketIndex
    )) {
      expect(send).toHaveBeenNthCalledWith(
        index + 1,
        JSON.stringify({ type: "data-changed", payload: { version: 42 } })
      )
    }
  })

  it("rejects invalid broadcast payloads", async () => {
    const { UserRealtimeRoom } = await import("../../workers/app")
    // SAFETY: Object.create preserves the class prototype; the test injects the ctx field used by fetch.
    const room = Object.create(UserRealtimeRoom.prototype) as UserRealtimeRoom
    Reflect.set(room, "ctx", { getWebSockets: () => [] })

    const response = await room.fetch(
      new Request("https://realtime.internal/notify-data-changed", {
        method: "POST",
        body: JSON.stringify({ version: -1 }),
      })
    )

    expect(response.status).toBe(400)
  })
})

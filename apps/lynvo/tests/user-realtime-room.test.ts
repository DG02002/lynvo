// @vitest-environment edge-runtime

import { describe, expect, it, vi } from "vitest"

vi.mock("virtual:react-router/server-build", () => ({}))
vi.mock("cloudflare:workers", () => ({ DurableObject: class {} }))

const runAlarm = async (
  database: unknown,
  attachment: Record<string, unknown> = {
    sessionId: "session-1",
    receiverId: "receiver-1",
    deviceName: "Living room",
    connectedAt: 1,
  }
) => {
  const { UserRealtimeRoom } = await import("../workers/app")
  const close = vi.fn()
  const socket = {
    close,
    deserializeAttachment: () => attachment,
  }
  const setAlarm = vi.fn(async () => undefined)
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
        sql.includes("FROM sessions") && activeSessionIds.includes(String(args[0]))
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
    const { UserRealtimeRoom } = await import("../workers/app")
    const close = vi.fn()
    const setAlarm = vi.fn(async () => undefined)
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

describe("UserRealtimeRoom inbox notification", () => {
  it.each([0, 2])("reports delivery to %s matching sockets", async (count) => {
    const { UserRealtimeRoom } = await import("../workers/app")
    const send = vi.fn()
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
    const { UserRealtimeRoom } = await import("../workers/app")
    const send = vi.fn()
    const room = Object.create(UserRealtimeRoom.prototype) as UserRealtimeRoom
    Reflect.set(room, "ctx", {
      getWebSockets: () =>
        Array.from({ length: count }, () => ({ send })),
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
    for (const index of Array.from({ length: count }, (_, socketIndex) => socketIndex)) {
      expect(send).toHaveBeenNthCalledWith(
        index + 1,
        JSON.stringify({ type: "data-changed", payload: { version: 42 } })
      )
    }
  })

  it("rejects invalid broadcast payloads", async () => {
    const { UserRealtimeRoom } = await import("../workers/app")
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

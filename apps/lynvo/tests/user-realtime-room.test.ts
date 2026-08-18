// @vitest-environment edge-runtime

import { describe, expect, it, vi } from "vitest"

vi.mock("virtual:react-router/server-build", () => ({}))
vi.mock("cloudflare:workers", () => ({ DurableObject: class {} }))

type ValidationResult = number | Error

const sendOnlySocket = (send: WebSocket["send"]): WebSocket => {
  // SAFETY: UserRealtimeRoom only reads WebSocket.send in synchronization tests.
  return { send } as WebSocket
}

const runAlarm = async (result: ValidationResult) => {
  const { UserRealtimeRoom } = await import("../workers/app")
  const close = vi.fn()
  const socket = {
    close,
    deserializeAttachment: () => ({ workerSessionId: "worker-session" }),
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
  Reflect.set(room, "env", {
    WORKER_AUTH_SESSION: {
      getByName: () => ({
        fetch: async () => {
          if (result instanceof Error) {
            throw result
          }
          return new Response(null, { status: result })
        },
      }),
    },
  })

  await room.alarm()
  return { close, setAlarm }
}

describe("UserRealtimeRoom session revalidation", () => {
  it.each([204, 503])(
    "keeps the socket connected after a %s validation response",
    async (status) => {
      const { close, setAlarm } = await runAlarm(status)

      expect(close).not.toHaveBeenCalled()
      expect(setAlarm).toHaveBeenCalledOnce()
    }
  )

  it.each([401, 404])(
    "authoritatively revokes the socket after a %s response",
    async (status) => {
      const { close, setAlarm } = await runAlarm(status)

      expect(close).toHaveBeenCalledWith(4001, "Session expired")
      expect(setAlarm).toHaveBeenCalledOnce()
    }
  )

  it("keeps the socket connected after a thrown validation request", async () => {
    const { close, setAlarm } = await runAlarm(new Error("platform outage"))

    expect(close).not.toHaveBeenCalled()
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

describe("UserRealtimeRoom saved-link synchronization", () => {
  it("requests reconciliation when the client revision is stale", async () => {
    const { UserRealtimeRoom } = await import("../workers/app")
    const send = vi.fn()
    const room = Object.create(UserRealtimeRoom.prototype) as UserRealtimeRoom
    Reflect.set(room, "ctx", {
      storage: { get: vi.fn(async () => 4) },
    })

    await room.webSocketMessage(
      sendOnlySocket(send),
      JSON.stringify({
        type: "saved-links.sync",
        payload: { revision: 3 },
      })
    )

    expect(send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "saved-links.sync",
        payload: { serverRevision: 4, reconcile: true },
      })
    )
  })

  it("durably schedules a near-term retry when immediate broadcast fails", async () => {
    const { UserRealtimeRoom } = await import("../workers/app")
    const setAlarm = vi.fn(async () => undefined)
    const put = vi.fn(async () => undefined)
    const room = Object.create(UserRealtimeRoom.prototype) as UserRealtimeRoom
    Reflect.set(room, "ctx", {
      getWebSockets: () => [
        {
          send: () => {
            throw new Error("socket unavailable")
          },
          close: vi.fn(),
        },
      ],
      storage: {
        get: vi.fn(async () => undefined),
        put,
        setAlarm,
      },
    })

    const response = await room.fetch(
      new Request("https://realtime.internal/broadcast", {
        method: "POST",
        body: JSON.stringify({
          type: "saved-links.changed",
          payload: { revision: 8 },
        }),
      })
    )

    expect(response.status).toBe(503)
    expect(put).toHaveBeenCalledWith("pendingSavedLinkBroadcast", {
      type: "saved-links.changed",
      payload: { revision: 8 },
    })
    expect(setAlarm).toHaveBeenCalledOnce()
  })

  it("retries and clears the coalesced broadcast from the durable alarm", async () => {
    const { UserRealtimeRoom } = await import("../workers/app")
    const send = vi.fn()
    const deletePending = vi.fn(async () => undefined)
    const room = Object.create(UserRealtimeRoom.prototype) as UserRealtimeRoom
    Reflect.set(room, "ctx", {
      getWebSockets: () => [
        {
          send,
          close: vi.fn(),
          deserializeAttachment: () => ({
            workerSessionId: "worker-session",
          }),
        },
      ],
      storage: {
        get: vi.fn(async (key: string) =>
          key === "pendingSavedLinkBroadcast"
            ? {
                type: "saved-links.changed",
                payload: { revision: 8 },
              }
            : undefined
        ),
        delete: deletePending,
        setAlarm: vi.fn(async () => undefined),
      },
    })
    Reflect.set(room, "env", {
      WORKER_AUTH_SESSION: {
        getByName: () => ({
          fetch: async () => new Response(null, { status: 204 }),
        }),
      },
    })

    await room.alarm()

    expect(send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "saved-links.changed",
        payload: { revision: 8 },
      })
    )
    expect(deletePending).toHaveBeenCalledWith("pendingSavedLinkBroadcast")
  })

  it("explicitly requests reconciliation when the room has no known revision", async () => {
    const { UserRealtimeRoom } = await import("../workers/app")
    const send = vi.fn()
    const room = Object.create(UserRealtimeRoom.prototype) as UserRealtimeRoom
    Reflect.set(room, "ctx", {
      storage: { get: vi.fn(async () => undefined) },
    })

    await room.webSocketMessage(
      sendOnlySocket(send),
      JSON.stringify({
        type: "saved-links.sync",
        payload: { revision: 3 },
      })
    )

    expect(send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "saved-links.sync",
        payload: { serverRevision: 3, reconcile: true },
      })
    )
  })
})

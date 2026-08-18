// @vitest-environment edge-runtime

import { describe, expect, it, vi } from "vitest"

vi.mock("virtual:react-router/server-build", () => ({}))
vi.mock("cloudflare:workers", () => ({ DurableObject: class {} }))

type ValidationResult = number | Error

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

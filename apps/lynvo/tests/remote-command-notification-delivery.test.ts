import { describe, expect, it, vi } from "vitest"
import { createRemoteCommandNotificationDelivery } from "../workers/remote-command-notification-delivery"
import { createFakeD1Database } from "./support/fake-d1"

describe("remote command notification delivery", () => {
  it("leaves the notification pending when no receiver socket was notified", async () => {
    const acknowledged: string[] = []
    const database = createFakeD1Database((sql) => {
      if (sql.includes("UPDATE remote_commands SET notification_pending")) {
        acknowledged.push(String("ack"))
        return { rows: [] }
      }
      return undefined
    })
    const delivery = createRemoteCommandNotificationDelivery(
      {
        USER_REALTIME_ROOM: {
          getByName: () => ({
            fetch: async () =>
              Response.json({ deliveredSocketCount: 0 }),
          }),
        } as Env["USER_REALTIME_ROOM"],
      },
      database as D1Database
    )

    await expect(
      delivery.deliver({
        commandId: "command-one",
        userId: "user-one",
        receiverId: "receiver-one",
      })
    ).resolves.toEqual({ kind: "unavailable" })
    expect(acknowledged).toEqual([])
  })

  it("broadcasts to the receiver room and acknowledges in D1", async () => {
    const notifiedReceivers: string[] = []
    const acknowledgedCommands: string[] = []
    const database = createFakeD1Database((sql, args) => {
      if (sql.includes("UPDATE remote_commands SET notification_pending = 0")) {
        acknowledgedCommands.push(String(args[0]))
        return { rows: [] }
      }
      return undefined
    })
    const environment = {
      USER_REALTIME_ROOM: {
        getByName: (userId: string) => ({
          fetch: async (url: string, init?: RequestInit) => {
            expect(url).toBe("https://realtime.internal/notify-inbox")
            expect(userId).toBe("user-one")
            const body = JSON.parse(String(init?.body)) as {
              receiverId: string
            }
            notifiedReceivers.push(body.receiverId)
            return Response.json({ deliveredSocketCount: 2 })
          },
        }),
      } as Env["USER_REALTIME_ROOM"],
    }
    const delivery = createRemoteCommandNotificationDelivery(
      environment,
      database as D1Database
    )

    await expect(
      delivery.deliver({
        commandId: "command-one",
        userId: "user-one",
        receiverId: "receiver-one",
      })
    ).resolves.toEqual({ kind: "completed" })
    expect(notifiedReceivers).toEqual(["receiver-one"])
    expect(acknowledgedCommands).toEqual(["command-one"])
  })

  it("drains every pending notification through broadcast and acknowledgement", async () => {
    const pendingRows = [
      {
        id: "command-1",
        user_id: "user-1",
        target_receiver_id: "receiver-1",
      },
      {
        id: "command-2",
        user_id: "user-2",
        target_receiver_id: "receiver-2",
      },
    ]
    const database = createFakeD1Database((sql, args) => {
      if (sql.includes("FROM remote_commands WHERE notification_pending = 1")) {
        return { rows: pendingRows }
      }
      if (sql.includes("notification_pending = 0")) {
        pendingRows.splice(
          pendingRows.findIndex((row) => row.id === args[0]),
          1
        )
        return { rows: [] }
      }
      return undefined
    })
    const deliveredTo: string[] = []
    const environment = {
      USER_REALTIME_ROOM: {
        getByName: (userId: string) => ({
          fetch: async (_url: string, init?: RequestInit) => {
            const body = JSON.parse(String(init?.body)) as {
              receiverId: string
            }
            deliveredTo.push(`${userId}:${body.receiverId}`)
            return Response.json({ deliveredSocketCount: 1 })
          },
        }),
      } as Env["USER_REALTIME_ROOM"],
    }
    const delivery = createRemoteCommandNotificationDelivery(
      environment,
      database as D1Database
    )

    await expect(delivery.drain()).resolves.toEqual({ kind: "completed" })
    expect(deliveredTo).toEqual(["user-1:receiver-1", "user-2:receiver-2"])
    expect(pendingRows).toEqual([])
  })

  it("reports an unavailable drain when the broadcast fails", async () => {
    const database = createFakeD1Database((sql) =>
      sql.includes("FROM remote_commands WHERE notification_pending = 1")
        ? {
            rows: [
              {
                id: "command-1",
                user_id: "user-1",
                target_receiver_id: "receiver-1",
              },
            ],
          }
        : undefined
    )
    const delivery = createRemoteCommandNotificationDelivery(
      {
        USER_REALTIME_ROOM: {
          getByName: () => ({
            fetch: async () =>
              Response.json({ error: "room unavailable" }, { status: 500 }),
          }),
        } as Env["USER_REALTIME_ROOM"],
      },
      database as D1Database
    )

    await expect(delivery.drain()).resolves.toEqual({ kind: "unavailable" })
  })

  it("completes an empty drain without a database binding", async () => {
    const delivery = createRemoteCommandNotificationDelivery(
      {} as { readonly USER_REALTIME_ROOM?: Env["USER_REALTIME_ROOM"] },
      undefined
    )
    await expect(delivery.drain()).resolves.toEqual({ kind: "completed" })
  })
})

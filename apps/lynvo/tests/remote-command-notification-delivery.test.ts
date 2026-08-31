import { describe, expect, it } from "vitest"
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
            fetch: async () => Response.json({ deliveredSocketCount: 0 }),
          }),
        },
      },
      database
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
    const delivery = createRemoteCommandNotificationDelivery(
      {
        USER_REALTIME_ROOM: {
          getByName: (userId) => ({
            fetch: async (url, init) => {
              expect(url).toBe("https://realtime.internal/notify-inbox")
              expect(userId).toBe("user-one")
              const body = JSON.parse(String(init?.body))
              expect(body).toEqual({ receiverId: "receiver-one" })
              notifiedReceivers.push("receiver-one")
              return Response.json({ deliveredSocketCount: 2 })
            },
          }),
        },
      },
      database
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
    const deliveredRequests: unknown[] = []
    const delivery = createRemoteCommandNotificationDelivery(
      {
        USER_REALTIME_ROOM: {
          getByName: (userId) => ({
            fetch: async (_url, init) => {
              deliveredRequests.push({
                userId,
                body: JSON.parse(String(init?.body)),
              })
              return Response.json({ deliveredSocketCount: 1 })
            },
          }),
        },
      },
      database
    )

    await expect(delivery.drain()).resolves.toEqual({ kind: "completed" })
    expect(deliveredRequests).toEqual([
      { userId: "user-1", body: { receiverId: "receiver-1" } },
      { userId: "user-2", body: { receiverId: "receiver-2" } },
    ])
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
        },
      },
      database
    )

    await expect(delivery.drain()).resolves.toEqual({ kind: "unavailable" })
  })

  it("completes an empty drain without a database binding", async () => {
    const delivery = createRemoteCommandNotificationDelivery({}, undefined)
    await expect(delivery.drain()).resolves.toEqual({ kind: "completed" })
  })
})

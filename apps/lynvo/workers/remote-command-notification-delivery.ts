import {
  acknowledgeRemoteCommandNotification,
  listPendingRemoteCommandNotifications,
  type PendingRemoteCommandNotification,
} from "./d1/remote-commands"
import { Result, Schema } from "effect"

const remoteInboxDeliverySchema = Schema.Struct({
  deliveredSocketCount: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
})

interface RemoteCommandRealtimeRoom {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

interface RemoteCommandRealtimeRoomNamespace {
  getByName: (name: string) => RemoteCommandRealtimeRoom
}

interface RemoteCommandNotificationEnvironment {
  readonly USER_REALTIME_ROOM?: RemoteCommandRealtimeRoomNamespace
}

export interface RemoteCommandNotificationDelivery {
  deliver: (
    notification: PendingRemoteCommandNotification
  ) => Promise<{ kind: "completed" | "unavailable" }>
  drain: () => Promise<{ kind: "completed" | "unavailable" }>
}

const broadcast = async (
  environment: RemoteCommandNotificationEnvironment,
  userId: string,
  receiverId: string
): Promise<void> => {
  if (!environment.USER_REALTIME_ROOM) {
    throw new Error("Remote command realtime room is unavailable")
  }
  const response = await environment.USER_REALTIME_ROOM.getByName(userId).fetch(
    "https://realtime.internal/notify-inbox",
    {
      method: "POST",
      body: JSON.stringify({ receiverId }),
    }
  )
  if (!response.ok) {
    throw new Error("Remote inbox notification failed")
  }
  if (
    Result.isFailure(
      Schema.decodeUnknownResult(remoteInboxDeliverySchema)(
        await response.json()
      )
    )
  ) {
    throw new Error("Remote inbox notification reached no receivers")
  }
}

export const createRemoteCommandNotificationDelivery = (
  environment: RemoteCommandNotificationEnvironment,
  database: D1Database | undefined
): RemoteCommandNotificationDelivery => {
  const deliver = async (
    notification: PendingRemoteCommandNotification
  ): Promise<{ kind: "completed" | "unavailable" }> => {
    try {
      await broadcast(environment, notification.userId, notification.receiverId)
      if (database) {
        await acknowledgeRemoteCommandNotification(
          database,
          notification.commandId
        )
      }
      return { kind: "completed" as const }
    } catch {
      return { kind: "unavailable" as const }
    }
  }
  return {
    deliver,
    drain: async () => {
      try {
        if (!database) {
          return { kind: "completed" as const }
        }
        const pending = await listPendingRemoteCommandNotifications(database)
        const results = await Promise.all(pending.map(deliver))
        return results.some((result) => result.kind === "unavailable")
          ? { kind: "unavailable" as const }
          : { kind: "completed" as const }
      } catch {
        return { kind: "unavailable" as const }
      }
    },
  }
}

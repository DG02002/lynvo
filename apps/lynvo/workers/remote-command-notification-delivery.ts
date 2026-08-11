import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api"
import { REMOTE_COMMAND_NOTIFICATION_TOKEN_TTL_MS } from "../convex/constants"
import { signRemoteCommandNotificationToken } from "../app/lib/auth-gateway"

declare global {
  interface PendingRemoteCommandNotification {
    readonly commandId: string
    readonly userId: string
    readonly receiverId: string
  }

  interface RemoteCommandNotificationEnvironment {
    readonly VITE_CONVEX_URL: string
    readonly AUTH_GATEWAY_SECRET?: string
    readonly USER_REALTIME_ROOM?: Env["USER_REALTIME_ROOM"]
  }
}

export const createRemoteCommandNotificationDelivery = (
  environment: RemoteCommandNotificationEnvironment
) => {
  const createServiceToken = async () => {
    if (!environment.AUTH_GATEWAY_SECRET) {
      throw new Error("Remote command notification delivery is unavailable")
    }
    return await signRemoteCommandNotificationToken(
      environment.AUTH_GATEWAY_SECRET,
      Date.now() + REMOTE_COMMAND_NOTIFICATION_TOKEN_TTL_MS
    )
  }
  const broadcast = async (notification: PendingRemoteCommandNotification) => {
    if (!environment.USER_REALTIME_ROOM) {
      throw new Error("Remote command realtime room is unavailable")
    }
    const response = await environment.USER_REALTIME_ROOM.getByName(
      notification.userId
    ).fetch("https://realtime.internal/notify-inbox", {
      method: "POST",
      body: JSON.stringify({ receiverId: notification.receiverId }),
    })
    if (!response.ok) {
      throw new Error("Remote inbox notification failed")
    }
  }
  const acknowledge = async (commandId: string) => {
    const client = new ConvexHttpClient(environment.VITE_CONVEX_URL)
    await client.mutation(api.remoteCommandNotifications.acknowledge, {
      serviceToken: await createServiceToken(),
      commandId,
    })
  }
  const deliver = async (notification: PendingRemoteCommandNotification) => {
    try {
      await broadcast(notification)
      await acknowledge(notification.commandId)
      return { kind: "completed" as const }
    } catch {
      return { kind: "unavailable" as const }
    }
  }
  return {
    deliver,
    drain: async () => {
      try {
        const client = new ConvexHttpClient(environment.VITE_CONVEX_URL)
        const pending = await client.query(
          api.remoteCommandNotifications.listPending,
          { serviceToken: await createServiceToken() }
        )
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

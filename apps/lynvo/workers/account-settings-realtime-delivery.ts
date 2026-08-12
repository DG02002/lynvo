import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api"
import { ACCOUNT_SETTINGS_REALTIME_TOKEN_TTL_MS } from "../convex/constants"
import { signAccountSettingsRealtimeToken } from "../app/lib/auth-gateway"

interface AccountSettingsRealtimeEnvironment {
  readonly VITE_CONVEX_URL: string
  readonly AUTH_GATEWAY_SECRET: string
  readonly USER_REALTIME_ROOM: Env["USER_REALTIME_ROOM"]
}

export const createAccountSettingsRealtimeDelivery = (
  environment: AccountSettingsRealtimeEnvironment
) => {
  const createToken = () =>
    signAccountSettingsRealtimeToken(
      environment.AUTH_GATEWAY_SECRET,
      Date.now() + ACCOUNT_SETTINGS_REALTIME_TOKEN_TTL_MS
    )
  const broadcast = async (userId: string, revision: number) => {
    const response = await environment.USER_REALTIME_ROOM.getByName(
      userId
    ).fetch("https://user-realtime-room/broadcast", {
      method: "POST",
      body: JSON.stringify({
        type: "account-settings.changed",
        payload: { revision },
      }),
    })
    if (!response.ok) {
      throw new Error("Account settings broadcast failed")
    }
  }
  const acknowledge = async (userId: string, revision: number) => {
    const client = new ConvexHttpClient(environment.VITE_CONVEX_URL)
    await client.mutation(api.accountSettingsRealtime.acknowledge, {
      serviceToken: await createToken(),
      userId,
      revision,
    })
  }
  return {
    deliver: async (userId: string, revision: number) => {
      try {
        await broadcast(userId, revision)
        await acknowledge(userId, revision)
        return { kind: "completed" as const }
      } catch {
        return { kind: "unavailable" as const }
      }
    },
    drain: async () => {
      try {
        const client = new ConvexHttpClient(environment.VITE_CONVEX_URL)
        const pending = await client.query(
          api.accountSettingsRealtime.listPending,
          {
            serviceToken: await createToken(),
          }
        )
        const outcomes = await Promise.all(
          pending.map(async (item) => {
            try {
              await broadcast(item.userId, item.revision)
              await acknowledge(item.userId, item.revision)
              return true
            } catch {
              return false
            }
          })
        )
        const failed = outcomes.filter((didDeliver) => !didDeliver).length
        return failed === 0
          ? { kind: "completed" as const }
          : { kind: "unavailable" as const }
      } catch {
        return { kind: "unavailable" as const }
      }
    },
  }
}

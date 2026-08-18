import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api"
import { SAVED_LINK_REALTIME_TOKEN_TTL_MS } from "../convex/constants"
import { signSavedLinkRealtimeToken } from "../app/lib/auth-gateway"

declare global {
  interface SavedLinkRealtimeDeliveryEnvironment {
    readonly VITE_CONVEX_URL: string
    readonly AUTH_GATEWAY_SECRET?: string
    readonly USER_REALTIME_ROOM?: Env["USER_REALTIME_ROOM"]
  }

  interface SavedLinkRealtimeDeliveryResult {
    kind: "completed" | "unavailable"
    listed: number
    broadcast: number
    acknowledged: number
    failed: number
  }

  interface SavedLinkRealtimeDeliveryAdapters {
    listPending: () => Promise<PendingSavedLinkDelivery[]>
    broadcast: (userId: string, revision: number) => Promise<void>
    acknowledge: (userId: string, revision: number) => Promise<void>
  }

  interface PendingSavedLinkDelivery {
    readonly userId: string
    readonly revision: number
  }
}

const emptyResult = (): SavedLinkRealtimeDeliveryResult => ({
  kind: "completed",
  listed: 0,
  broadcast: 0,
  acknowledged: 0,
  failed: 0,
})

export const createSavedLinkRealtimeDelivery = (
  environment: SavedLinkRealtimeDeliveryEnvironment,
  injectedAdapters?: SavedLinkRealtimeDeliveryAdapters
) => {
  const createServiceToken = async () => {
    if (!environment.AUTH_GATEWAY_SECRET) {
      throw new Error("Saved link realtime delivery is unavailable")
    }
    return await signSavedLinkRealtimeToken(
      environment.AUTH_GATEWAY_SECRET,
      Date.now() + SAVED_LINK_REALTIME_TOKEN_TTL_MS
    )
  }
  const broadcast = async (userId: string, revision: number) => {
    if (!environment.USER_REALTIME_ROOM) {
      throw new Error("Saved link realtime room is unavailable")
    }
    const response = await environment.USER_REALTIME_ROOM.getByName(
      userId
    ).fetch("https://user-realtime-room/broadcast", {
      method: "POST",
      body: JSON.stringify({
        type: "saved-links.changed",
        payload: { revision },
      }),
    })
    if (!response.ok) {
      throw new Error("Room broadcast failed")
    }
  }
  const acknowledgeWithClient = async (userId: string, revision: number) => {
    const client = new ConvexHttpClient(environment.VITE_CONVEX_URL)
    await client.mutation(api.savedLinkRealtime.acknowledge, {
      serviceToken: await createServiceToken(),
      userId,
      revision,
    })
  }
  const adapters: SavedLinkRealtimeDeliveryAdapters = injectedAdapters ?? {
    broadcast,
    acknowledge: acknowledgeWithClient,
    listPending: async () => {
      const client = new ConvexHttpClient(environment.VITE_CONVEX_URL)
      return await client.query(api.savedLinkRealtime.listPending, {
        serviceToken: await createServiceToken(),
      })
    },
  }
  return {
    deliver: async (userId: string, revision: number) => {
      try {
        await adapters.broadcast(userId, revision)
      } catch {
        return { ...emptyResult(), kind: "unavailable" as const, failed: 1 }
      }
      try {
        await adapters.acknowledge(userId, revision)
        return { ...emptyResult(), broadcast: 1, acknowledged: 1 }
      } catch {
        return {
          ...emptyResult(),
          kind: "unavailable" as const,
          broadcast: 1,
          failed: 1,
        }
      }
    },
    drain: async (): Promise<SavedLinkRealtimeDeliveryResult> => {
      try {
        const pending = await adapters.listPending()
        const outcomes = await Promise.all(
          pending.map(async (item) => {
            let broadcast = 0
            try {
              await adapters.broadcast(item.userId, item.revision)
              broadcast = 1
              await adapters.acknowledge(item.userId, item.revision)
              return { broadcast, acknowledged: 1, failed: 0 }
            } catch {
              return { broadcast, acknowledged: 0, failed: 1 }
            }
          })
        )
        const result = outcomes.reduce<SavedLinkRealtimeDeliveryResult>(
          (currentResult, outcome) => ({
            ...currentResult,
            broadcast: currentResult.broadcast + outcome.broadcast,
            acknowledged: currentResult.acknowledged + outcome.acknowledged,
            failed: currentResult.failed + outcome.failed,
          }),
          { ...emptyResult(), listed: pending.length }
        )
        return result.failed > 0 ? { ...result, kind: "unavailable" } : result
      } catch {
        return { ...emptyResult(), kind: "unavailable", failed: 1 }
      }
    },
  }
}

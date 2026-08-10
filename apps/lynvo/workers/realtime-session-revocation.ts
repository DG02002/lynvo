import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api"
import { SESSION_CLEANUP_TOKEN_TTL_MS } from "../convex/constants"
import { signSessionCleanupToken } from "../app/lib/auth-gateway"

interface RealtimeRoomNamespace {
  getByName: (userId: string) => {
    fetch: (url: string, init?: RequestInit) => Promise<Response>
  }
}

interface PendingRealtimeSessionRevocation {
  readonly userId: string
  readonly sessionId?: string
}

interface RealtimeSessionRevocationEnvironment {
  readonly VITE_CONVEX_URL: string
  readonly AUTH_GATEWAY_SECRET: string
  readonly USER_REALTIME_ROOM: RealtimeRoomNamespace
}

export const createRealtimeSessionRevocation = (
  realtimeRoom: RealtimeRoomNamespace
) => ({
  closeSession: async (userId: string, sessionId: string) => {
    const response = await realtimeRoom
      .getByName(userId)
      .fetch("https://user-realtime-room/revoke-session", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      })
    if (!response.ok) {
      throw new Error("Realtime session revocation failed")
    }
  },
  closeAccount: async (userId: string) => {
    const response = await realtimeRoom
      .getByName(userId)
      .fetch("https://user-realtime-room/revoke-account", { method: "POST" })
    if (!response.ok) {
      throw new Error("Realtime account revocation failed")
    }
  },
})

export const createDurableRealtimeSessionRevocation = (
  environment: RealtimeSessionRevocationEnvironment
) => {
  const room = createRealtimeSessionRevocation(environment.USER_REALTIME_ROOM)
  const createToken = () =>
    signSessionCleanupToken(
      environment.AUTH_GATEWAY_SECRET,
      Date.now() + SESSION_CLEANUP_TOKEN_TTL_MS
    )
  const attempt = async (intent: PendingRealtimeSessionRevocation) => {
    if (intent.sessionId) {
      await room.closeSession(intent.userId, intent.sessionId)
    } else {
      await room.closeAccount(intent.userId)
    }
  }
  return {
    deliver: async (intent: PendingRealtimeSessionRevocation) => {
      try {
        await attempt(intent)
        const client = new ConvexHttpClient(environment.VITE_CONVEX_URL)
        await client.mutation(api.realtimeSessionRevocations.complete, {
          serviceToken: await createToken(),
          ...intent,
        })
        return { kind: "completed" as const }
      } catch {
        return { kind: "unavailable" as const }
      }
    },
    drain: async () => {
      try {
        const client = new ConvexHttpClient(environment.VITE_CONVEX_URL)
        const serviceToken = await createToken()
        const pending = await client.query(
          api.realtimeSessionRevocations.listPending,
          { serviceToken }
        )
        let failed = 0
        for (const intent of pending) {
          try {
            await attempt(intent)
            await client.mutation(api.realtimeSessionRevocations.complete, {
              serviceToken,
              ...intent,
            })
          } catch {
            failed += 1
          }
        }
        return failed === 0
          ? { kind: "completed" as const }
          : { kind: "unavailable" as const }
      } catch {
        return { kind: "unavailable" as const }
      }
    },
  }
}

interface RealtimeRoomNamespace {
  getByName: (userId: string) => {
    fetch: (url: string, init?: RequestInit) => Promise<Response>
  }
}

interface RealtimeSessionRevocationEnvironment {
  readonly USER_REALTIME_ROOM?: RealtimeRoomNamespace
}

const closeSessionPath = "https://user-realtime-room/revoke-session"
const closeAccountPath = "https://user-realtime-room/revoke-account"

export const closeRealtimeSession = async (
  environment: RealtimeSessionRevocationEnvironment,
  userId: string,
  sessionId: string
): Promise<void> => {
  await environment.USER_REALTIME_ROOM?.getByName(userId).fetch(
    closeSessionPath,
    {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    }
  )
}

export const closeRealtimeAccount = async (
  environment: RealtimeSessionRevocationEnvironment,
  userId: string
): Promise<void> => {
  await environment.USER_REALTIME_ROOM?.getByName(userId).fetch(
    closeAccountPath,
    { method: "POST" }
  )
}

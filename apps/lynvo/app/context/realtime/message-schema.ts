import { z } from "zod"
import { remoteCommandWireMessageSchema } from "~/lib/remote-play/wire"

declare global {
  interface RemoteInboxChangedRealtimeMessage {
    type: "remote-inbox.changed"
    payload: Record<string, never>
  }

  type RealtimeMessage =
    | RemoteCommandWireMessage
    | RemoteInboxChangedRealtimeMessage
}

export const remoteInboxChangedRealtimeMessageSchema = z.strictObject({
  type: z.literal("remote-inbox.changed"),
  payload: z.strictObject({}),
})

const heartbeatResponseSchema = z.strictObject({
  type: z.literal("pong"),
  payload: z.strictObject({ at: z.number() }),
})

export const isRealtimeHeartbeatResponse = (value: string): boolean => {
  try {
    return heartbeatResponseSchema.safeParse(JSON.parse(value)).success
  } catch {
    return false
  }
}

export const parseRealtimeMessage = (value: string): RealtimeMessage | null => {
  try {
    const parsed = JSON.parse(value)
    if (remoteCommandWireMessageSchema.safeParse(parsed).success) {
      const remoteResult = remoteCommandWireMessageSchema.safeParse(parsed)
      return remoteResult.success ? remoteResult.data : null
    }
    const result = remoteInboxChangedRealtimeMessageSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

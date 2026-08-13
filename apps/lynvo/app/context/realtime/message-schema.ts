import { z } from "zod"
import { remoteCommandWireMessageSchema } from "~/lib/remote-play/wire"

declare global {
  interface SavedLinksChangedRealtimeMessage {
    type: "saved-links.changed"
    payload: { revision: number }
  }

  interface AccountSettingsChangedRealtimeMessage {
    type: "account-settings.changed"
    payload: { revision: number }
  }

  interface RemoteInboxChangedRealtimeMessage {
    type: "remote-inbox.changed"
    payload: Record<string, never>
  }

  type RealtimeMessage =
    | RemoteCommandWireMessage
    | SavedLinksChangedRealtimeMessage
    | AccountSettingsChangedRealtimeMessage
    | RemoteInboxChangedRealtimeMessage
}

export const savedLinksChangedRealtimeMessageSchema = z.strictObject({
  type: z.literal("saved-links.changed"),
  payload: z.strictObject({ revision: z.number().int().nonnegative() }),
})

export const accountSettingsChangedRealtimeMessageSchema = z.strictObject({
  type: z.literal("account-settings.changed"),
  payload: z.strictObject({ revision: z.number().int().nonnegative() }),
})

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
    const result = z
      .union([
        savedLinksChangedRealtimeMessageSchema,
        accountSettingsChangedRealtimeMessageSchema,
        remoteInboxChangedRealtimeMessageSchema,
      ])
      .safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

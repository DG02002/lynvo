import { z } from "zod"
import { remoteCommandWireMessageSchema } from "~/lib/remote-play/wire"

declare global {
  interface RealtimeMessage {
    type: string
    payload?: unknown
  }
}

export const realtimeMessageSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export const parseRealtimeMessage = (value: string): RealtimeMessage | null => {
  try {
    const parsed: unknown = JSON.parse(value)
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "type" in parsed &&
      parsed.type === "remote.event"
    ) {
      const remoteResult = remoteCommandWireMessageSchema.safeParse(parsed)
      return remoteResult.success ? remoteResult.data : null
    }
    const result = realtimeMessageSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export const isRemoteRealtimeMessage = (
  message: RealtimeMessage
): message is RemoteCommandWireMessage => message.type === "remote.event"

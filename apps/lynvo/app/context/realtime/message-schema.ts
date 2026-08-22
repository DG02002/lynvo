import { z } from "zod"
import { remoteCommandWireMessageSchema } from "~/lib/remote-play/wire"

declare global {
  interface RemoteInboxChangedRealtimeMessage {
    type: "remote-inbox.changed"
    payload: Record<string, never>
  }

  interface SessionHelloRealtimeMessage {
    type: "session_hello"
    userId: string
    sessionId: string
    dataVersion?: number
  }

  interface DataChangedRealtimeMessage {
    type: "data-changed"
    payload: { version: number }
  }

  type RealtimeMessage =
    | RemoteCommandWireMessage
    | RemoteInboxChangedRealtimeMessage
    | DataChangedRealtimeMessage
    | SessionHelloRealtimeMessage
}

export const remoteInboxChangedRealtimeMessageSchema = z.strictObject({
  type: z.literal("remote-inbox.changed"),
  payload: z.strictObject({}),
})

export const sessionHelloRealtimeMessageSchema = z.object({
  type: z.literal("session_hello"),
  userId: z.string(),
  sessionId: z.string(),
  dataVersion: z.number().int().positive().optional(),
})

export const dataChangedRealtimeMessageSchema = z.strictObject({
  type: z.literal("data-changed"),
  payload: z.strictObject({ version: z.number().int().positive() }),
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
const parseFirstMatchingRealtimeMessage = (
  value: string
): RealtimeMessage | null => {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }
  const remoteResult = remoteCommandWireMessageSchema.safeParse(parsed)
  if (remoteResult.success) {
    return remoteResult.data
  }
  const inboxResult = remoteInboxChangedRealtimeMessageSchema.safeParse(parsed)
  if (inboxResult.success) {
    return inboxResult.data
  }
  const dataChangedResult = dataChangedRealtimeMessageSchema.safeParse(parsed)
  if (dataChangedResult.success) {
    return dataChangedResult.data
  }
  const helloResult = sessionHelloRealtimeMessageSchema.safeParse(parsed)
  if (helloResult.success) {
    return helloResult.data
  }
  return null
}

export const parseRealtimeMessage = (value: string): RealtimeMessage | null =>
  parseFirstMatchingRealtimeMessage(value)

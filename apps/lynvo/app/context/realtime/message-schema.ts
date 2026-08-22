import { Result, Schema } from "effect"
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

export const remoteInboxChangedRealtimeMessageSchema = Schema.Struct({
  type: Schema.Literal("remote-inbox.changed"),
  payload: Schema.Struct({}),
})

export const sessionHelloRealtimeMessageSchema = Schema.Struct({
  type: Schema.Literal("session_hello"),
  userId: Schema.String,
  sessionId: Schema.String,
  dataVersion: Schema.optional(
    Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0)))
  ),
})

export const dataChangedRealtimeMessageSchema = Schema.Struct({
  type: Schema.Literal("data-changed"),
  payload: Schema.Struct({
    version: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
  }),
})

const heartbeatResponseSchema = Schema.Struct({
  type: Schema.Literal("pong"),
  payload: Schema.Struct({ at: Schema.Number }),
})

export const isRealtimeHeartbeatResponse = (value: string): boolean => {
  try {
    return Result.isSuccess(
      Schema.decodeUnknownResult(heartbeatResponseSchema)(JSON.parse(value))
    )
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
  const remoteResult = Schema.decodeUnknownResult(
    remoteCommandWireMessageSchema
  )(parsed)
  if (Result.isSuccess(remoteResult)) {
    return remoteResult.success
  }
  const inboxResult = Schema.decodeUnknownResult(
    remoteInboxChangedRealtimeMessageSchema
  )(parsed)
  if (Result.isSuccess(inboxResult)) {
    return inboxResult.success
  }
  const dataChangedResult = Schema.decodeUnknownResult(
    dataChangedRealtimeMessageSchema
  )(parsed)
  if (Result.isSuccess(dataChangedResult)) {
    return dataChangedResult.success
  }
  const helloResult = Schema.decodeUnknownResult(
    sessionHelloRealtimeMessageSchema
  )(parsed)
  if (Result.isSuccess(helloResult)) {
    return helloResult.success
  }
  return null
}

export const parseRealtimeMessage = (value: string): RealtimeMessage | null =>
  parseFirstMatchingRealtimeMessage(value)

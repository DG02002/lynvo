import { Result, Schema } from "effect"
import {
  dataChangedRealtimeMessageSchema,
  remoteInboxChangedRealtimeMessageSchema,
  sessionHelloRealtimeMessageSchema,
  type DataChangedRealtimeMessage,
  type RemoteInboxChangedRealtimeMessage,
  type SessionHelloRealtimeMessage,
} from "~shared/realtime-messages"

import { remoteCommandWireMessageSchema } from "~/lib/remote-play/wire"

declare global {
  type RealtimeMessage =
    | RemoteCommandWireMessage
    | RemoteInboxChangedRealtimeMessage
    | DataChangedRealtimeMessage
    | SessionHelloRealtimeMessage
}

export const isRealtimeHeartbeatResponse = (value: string): boolean => {
  // The Durable Object's hibernation pair answers bare "ping" with "pong" without waking it.
  return value === "pong"
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

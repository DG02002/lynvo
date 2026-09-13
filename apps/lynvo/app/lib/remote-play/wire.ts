import { Schema } from "effect"

declare global {
  interface RemoteCommandWireFields {
    id: string
    claimToken: string
    command: "play"
    payload: string
    createdAt: number
  }

  interface RemoteCommandWirePayload extends RemoteCommandWireFields {
    kind: "command"
    targetSessionId: string
  }

  interface RemoteCommandWireMessage {
    type: "remote.event"
    payload: RemoteCommandWirePayload
  }
}

export const remoteCommandFieldsSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  claimToken: Schema.NonEmptyString,
  command: Schema.Literal("play"),
  // The API preserves data-less play commands; delivery validates the parsed
  // playback intent immediately before execution.
  payload: Schema.String,
  createdAt: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    Schema.check(Schema.isFinite())
  ),
})

export const remoteCommandWirePayloadSchema = Schema.Struct({
  ...remoteCommandFieldsSchema.fields,
  kind: Schema.Literal("command"),
  targetSessionId: Schema.NonEmptyString,
})

export const remoteCommandWireMessageSchema = Schema.Struct({
  type: Schema.Literal("remote.event"),
  payload: remoteCommandWirePayloadSchema,
})

export const createRemoteCommandMessage = (
  payload: Omit<RemoteCommandWirePayload, "kind">
): RemoteCommandWireMessage => ({
  type: "remote.event",
  payload: { kind: "command", ...payload },
})

import { Schema } from "effect"
import {
  remoteCommandFieldsSchema,
  remoteCommandWirePayloadSchema,
} from "~/lib/remote-play/wire"

export const remoteDeviceSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
})

export const remotePollResponseSchema = Schema.Struct({
  controlledBy: Schema.optional(Schema.NullOr(Schema.NonEmptyString)),
  controllerName: Schema.optional(Schema.String),
  controllingDevices: Schema.optional(Schema.Array(remoteDeviceSchema)),
  activeTargets: Schema.optional(Schema.Array(Schema.NonEmptyString)),
  commands: Schema.optional(Schema.Array(remoteCommandFieldsSchema)),
})

export const remoteRealtimeEventSchema = Schema.Union([
  remoteCommandWirePayloadSchema,
  Schema.Struct({
    kind: Schema.Literal("connections"),
    controllingDevices: Schema.Array(remoteDeviceSchema),
  }),
  Schema.Struct({
    kind: Schema.Literal("targets"),
    activeTargets: Schema.Array(Schema.NonEmptyString),
  }),
])

export type ValidRemotePollResponse = typeof remotePollResponseSchema.Type
export type ValidRemoteRealtimeEvent = typeof remoteRealtimeEventSchema.Type

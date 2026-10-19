import { Schema } from "effect"

const positiveDataVersionSchema = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThan(0))
)

export const receiverNotificationRequestSchema = Schema.Struct({
  receiverId: Schema.String,
})

export const sessionRevocationRequestSchema = Schema.Struct({
  sessionId: Schema.String,
})

export const dataChangedRequestSchema = Schema.Struct({
  version: positiveDataVersionSchema,
})

export const receiverAttachmentSchema = Schema.Struct({
  receiverId: Schema.String,
  sessionId: Schema.String,
  deviceName: Schema.String,
  connectedAt: Schema.Number,
})

export const remoteInboxChangedRealtimeMessageSchema = Schema.Struct({
  type: Schema.Literal("remote-inbox.changed"),
  payload: Schema.Struct({}),
})

export const sessionHelloRealtimeMessageSchema = Schema.Struct({
  type: Schema.Literal("session_hello"),
  userId: Schema.String,
  sessionId: Schema.String,
  dataVersion: Schema.optional(positiveDataVersionSchema),
})

export const dataChangedRealtimeMessageSchema = Schema.Struct({
  type: Schema.Literal("data-changed"),
  payload: Schema.Struct({ version: positiveDataVersionSchema }),
})

export const receiversResponseSchema = Schema.Struct({
  receivers: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      receiverId: Schema.String,
      deviceName: Schema.String,
      lastActiveAt: Schema.Number,
    })
  ),
})

export type DataChangedRealtimeMessage = Schema.Schema.Type<
  typeof dataChangedRealtimeMessageSchema
>
export type RemoteInboxChangedRealtimeMessage = Schema.Schema.Type<
  typeof remoteInboxChangedRealtimeMessageSchema
>
export type SessionHelloRealtimeMessage = Schema.Schema.Type<
  typeof sessionHelloRealtimeMessageSchema
>

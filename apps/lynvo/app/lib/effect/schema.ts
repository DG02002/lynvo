import { Schema } from "effect"

export const LinkSchema = Schema.Struct({
  url: Schema.String,
  title: Schema.optional(Schema.String),
  meta: Schema.optional(Schema.Unknown),
})

export const TvAuthorizeSchema = Schema.Struct({
  code: Schema.String,
  deviceName: Schema.optional(Schema.String),
})

export const RemoteCommandSchema = Schema.Struct({
  target_session_id: Schema.String,
  command: Schema.Literals(["play", "pause"]),
  data: Schema.optional(Schema.Unknown),
})

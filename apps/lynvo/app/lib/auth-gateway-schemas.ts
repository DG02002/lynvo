import { Schema } from "effect"

export const deviceCodeRequestSchema = Schema.Struct({
  deviceName: Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(256)),
})

export const deviceCodeResponseSchema = Schema.Struct({
  code: Schema.NonEmptyString,
  pollSecret: Schema.NonEmptyString,
  expiresAt: Schema.Number,
  deviceName: Schema.NonEmptyString,
})

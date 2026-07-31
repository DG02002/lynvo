import { z } from "zod"

const AUTH_GATEWAY_STRING_MAX_LENGTH = 4_096
const TURNSTILE_TOKEN_MAX_LENGTH = 2_048

export const authPreflightRequestSchema = z.strictObject({
  flow: z.enum(["signIn", "signUp"]),
  username: z.string().max(AUTH_GATEWAY_STRING_MAX_LENGTH),
  turnstileToken: z.string().max(TURNSTILE_TOKEN_MAX_LENGTH),
})

export const authSignInRequestSchema = z.strictObject({
  provider: z.literal("credentials"),
  params: z.record(z.string(), z.string().max(AUTH_GATEWAY_STRING_MAX_LENGTH)),
})

export const deviceCodeRequestSchema = z.strictObject({
  deviceName: z.string().trim().min(1).max(256),
})

export const authPreflightResponseSchema = z.strictObject({
  preflightToken: z.string().min(1),
})

export const deviceCodeResponseSchema = z.strictObject({
  code: z.string().min(1),
  pollSecret: z.string().min(1),
  expiresAt: z.number(),
  deviceName: z.string().min(1),
})

export const turnstileVerificationResponseSchema = z.object({
  success: z.boolean(),
  hostname: z.string(),
  action: z.string(),
})

export const refreshedAuthTokensSchema = z.object({
  tokens: z
    .strictObject({
      token: z.string().min(1),
      refreshToken: z.string().min(1),
    })
    .nullable()
    .optional(),
})

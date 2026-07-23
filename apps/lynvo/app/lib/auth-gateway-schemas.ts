import { z } from "zod"

const AUTH_GATEWAY_STRING_MAX_LENGTH = 4_096

export const authPreflightRequestSchema = z
  .object({
    flow: z.enum(["signIn", "signUp"]),
    username: z.string().max(AUTH_GATEWAY_STRING_MAX_LENGTH),
    turnstileToken: z.string().max(AUTH_GATEWAY_STRING_MAX_LENGTH),
  })
  .strict()

export const authSignInRequestSchema = z
  .object({
    provider: z.literal("credentials"),
    params: z.record(
      z.string(),
      z.string().max(AUTH_GATEWAY_STRING_MAX_LENGTH)
    ),
  })
  .strict()

export const deviceCodeRequestSchema = z
  .object({
    deviceName: z.string().trim().min(1).max(256),
  })
  .strict()

export const authPreflightResponseSchema = z
  .object({
    preflightToken: z.string().min(1).optional(),
    error: z.string().min(1).optional(),
  })
  .strip()

export const turnstileVerificationResponseSchema = z
  .object({
    success: z.boolean(),
    hostname: z.string().optional(),
  })
  .strip()

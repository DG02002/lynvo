import { z } from "zod"

export const deviceCodeRequestSchema = z.strictObject({
  deviceName: z.string().trim().min(1).max(256),
})

export const deviceCodeResponseSchema = z.strictObject({
  code: z.string().min(1),
  pollSecret: z.string().min(1),
  expiresAt: z.number(),
  deviceName: z.string().min(1),
})

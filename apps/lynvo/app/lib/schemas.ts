import { z } from "zod"

export const linkSchema = z.object({
  url: z.string().url("Invalid URL format"),
  title: z.string().optional(),
  meta: z.unknown().optional(),
})

export const tvAuthorizeSchema = z.object({
  code: z.string().min(1, "Code is required"),
  deviceName: z.string().optional(),
})

export const remoteCommandSchema = z.object({
  target_session_id: z.string().uuid("Invalid session ID"),
  command: z.string().min(1, "Command is required"),
  data: z.unknown().optional(),
})

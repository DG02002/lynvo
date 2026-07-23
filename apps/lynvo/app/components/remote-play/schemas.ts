import { z } from "zod"

export const remoteSessionSchema = z
  .object({
    id: z.string().min(1),
    device_name: z.string().min(1),
    user_agent: z.string(),
    last_active_at: z.number(),
    location: z.string(),
  })
  .strip()

export const remoteSessionsResponseSchema = z
  .object({
    sessions: z.array(remoteSessionSchema),
  })
  .strip()

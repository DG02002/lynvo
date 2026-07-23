import { z } from "zod"

export const realtimeMessageSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export type RealtimeMessage = z.infer<typeof realtimeMessageSchema>

export const parseRealtimeMessage = (value: string): RealtimeMessage | null => {
  try {
    const parsed: unknown = JSON.parse(value)
    const result = realtimeMessageSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

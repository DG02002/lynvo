import { z } from "zod"

const rateLimitPayloadSchema = z.object({
  limit: z.number().int().positive(),
  nowMs: z.number().int().nonnegative(),
  windowMs: z.number().int().positive(),
})

export class AuthRateLimiter implements DurableObject {
  constructor(private readonly state: DurableObjectState) {}

  fetch = async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return new Response(null, { status: 405 })
    }

    const payload = rateLimitPayloadSchema.safeParse(await request.json())
    if (!payload.success) {
      return new Response(null, { status: 400 })
    }

    const { limit, nowMs, windowMs } = payload.data
    const result = await this.state.storage.transaction(async (storage) => {
      const current = await storage.get<{ count: number; expiresAt: number }>(
        "window"
      )
      const window =
        current === undefined || nowMs >= current.expiresAt
          ? { count: 0, expiresAt: nowMs + windowMs }
          : current
      if (window.count >= limit) {
        return { allowed: false, expiresAt: window.expiresAt }
      }
      await storage.put("window", { ...window, count: window.count + 1 })
      return { allowed: true, expiresAt: window.expiresAt }
    })

    return Response.json(result, { status: result.allowed ? 200 : 429 })
  }
}

import { Result, Schema } from "effect"

const rateLimitPayloadSchema = Schema.Struct({
  limit: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
  nowMs: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  windowMs: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
})

export class AuthRateLimiter implements DurableObject {
  constructor(private readonly state: DurableObjectState) {}

  fetch = async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return new Response(null, { status: 405 })
    }

    const payload = Schema.decodeUnknownResult(rateLimitPayloadSchema)(
      await request.json().catch(() => null)
    )
    if (Result.isFailure(payload)) {
      return new Response(null, { status: 400 })
    }

    const { limit, nowMs, windowMs } = payload.success
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

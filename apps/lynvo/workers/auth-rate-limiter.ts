export class AuthRateLimiter implements DurableObject {
  constructor(private readonly state: DurableObjectState) {}

  fetch = async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return new Response(null, { status: 405 })
    }

    const payload: unknown = await request.json()
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("limit" in payload) ||
      !("nowMs" in payload) ||
      !("windowMs" in payload) ||
      !Number.isSafeInteger(payload.limit) ||
      !Number.isSafeInteger(payload.nowMs) ||
      !Number.isSafeInteger(payload.windowMs) ||
      Number(payload.limit) < 1 ||
      Number(payload.nowMs) < 0 ||
      Number(payload.windowMs) < 1
    ) {
      return new Response(null, { status: 400 })
    }

    const limit = Number(payload.limit)
    const nowMs = Number(payload.nowMs)
    const windowMs = Number(payload.windowMs)
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

import type { MiddlewareHandler } from "hono"

export const responseSecurityHeaders =
  (): MiddlewareHandler => async (context, next) => {
    await next()
    if (context.res.status === 101) {
      return
    }
    context.res.headers.set("Strict-Transport-Security", "max-age=31536000")
    context.res.headers.set("X-Content-Type-Options", "nosniff")
    context.res.headers.set("X-Frame-Options", "DENY")
    context.res.headers.set(
      "Referrer-Policy",
      "strict-origin-when-cross-origin"
    )
    context.res.headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()"
    )
  }

import type { MiddlewareHandler } from "hono"

export const applyResponseSecurityHeaders = (headers: Headers): void => {
  headers.set("X-Content-Type-Options", "nosniff")
  headers.set("X-Frame-Options", "DENY")
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
}

export const responseSecurityHeaders =
  (): MiddlewareHandler => async (context, next) => {
    await next()
    if (context.res.status === 101) {
      return
    }
    context.res.headers.set("Strict-Transport-Security", "max-age=31536000")
    applyResponseSecurityHeaders(context.res.headers)
    if (context.req.path.startsWith("/api/")) {
      context.res.headers.set("Cache-Control", "no-store")
    }
  }

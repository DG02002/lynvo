import { createCookie } from "react-router"

const isProd = import.meta.env.PROD

export const csrfCookie = createCookie("csrf-token", {
  path: "/",
  httpOnly: false, // Client needs to read this to send in header
  secure: isProd,
  sameSite: "lax",
  maxAge: 60 * 60 * 24, // 1 day
})

export async function validateCSRF(request: Request, formData?: FormData) {
  // 1. Check Origin/Referer
  // Skip strict origin checks in DEV to allow local testing (e.g. --host, tunnels)
  if (!import.meta.env.DEV) {
    const origin = request.headers.get("Origin")
    const referer = request.headers.get("Referer")
    const host = request.headers.get("Host")

    if (origin) {
      const originUrl = new URL(origin)
      if (originUrl.host !== host) {
        return false
      }
    } else if (referer) {
      const refererUrl = new URL(referer)
      if (refererUrl.host !== host) {
        return false
      }
    } else {
      // Block if neither is present (strict)
      return false
    }
  }

  // 2. Check CSRF Token (Double Submit Cookie)
  const cookieHeader = request.headers.get("Cookie")
  const cookieToken = await csrfCookie.parse(cookieHeader)
  let token = request.headers.get("X-CSRF-Token")

  if (!token && formData) {
    token = formData.get("csrf-token") as string
  }

  if (!cookieToken || !token || cookieToken !== token) {
    if (import.meta.env.DEV) {
      console.error("CSRF Validation Failed:", {
        cookieToken,
        formToken: token,
        cookieHeader: cookieHeader ? "present" : "missing",
      })
    }
    return false
  }

  return true
}

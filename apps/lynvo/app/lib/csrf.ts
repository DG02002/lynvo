import { createCookie } from "react-router"
import { Result, Schema } from "effect"

const isProd = import.meta.env.PROD

export const csrfCookie = createCookie("csrf-token", {
  path: "/",
  httpOnly: false, // Client needs to read this to send in header
  secure: isProd,
  sameSite: "lax",
  maxAge: 60 * 60 * 24, // 1 day
})

const matchesRequestHost = (headerValue: string, host: string | null) =>
  URL.canParse(headerValue) && new URL(headerValue).host === host

const isTrustedRequestOrigin = (request: Request): boolean => {
  // Skip strict origin checks in DEV for local testing and tunnels.
  if (import.meta.env.DEV) {
    return true
  }
  const origin = request.headers.get("Origin")
  const referer = request.headers.get("Referer")
  const host = request.headers.get("Host")
  if (origin) {
    return matchesRequestHost(origin, host)
  }
  if (referer) {
    return matchesRequestHost(referer, host)
  }
  return false
}

interface SubmittedCsrfToken {
  cookieHeader: string | null
  cookieToken: string | false
  token: string | null
}

const readSubmittedCsrfToken = async (
  request: Request,
  formData?: FormData
): Promise<SubmittedCsrfToken> => {
  const cookieHeader = request.headers.get("Cookie")
  const cookieToken = await csrfCookie.parse(cookieHeader)
  let token = request.headers.get("X-CSRF-Token")
  if (!token && formData) {
    const formToken = Schema.decodeUnknownResult(Schema.String)(
      formData.get("csrf-token")
    )
    token = Result.isSuccess(formToken) ? formToken.success : null
  }
  return { cookieHeader, cookieToken, token }
}

export const validateCSRF = async (request: Request, formData?: FormData) => {
  if (!isTrustedRequestOrigin(request)) {
    return false
  }

  const { cookieHeader, cookieToken, token } = await readSubmittedCsrfToken(
    request,
    formData
  )
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

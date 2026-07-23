import { authPreflightResponseSchema } from "~/lib/auth-gateway-schemas"

export type AuthPreflightFlow = "signIn" | "signUp"

export const initialTurnstileToken = () =>
  import.meta.env.DEV ? "dev-token" : ""

export const authPreflight = async (payload: {
  flow: AuthPreflightFlow
  username: string
  turnstileToken: string
}) => {
  const response = await fetch("/api/auth/preflight", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const result = authPreflightResponseSchema.safeParse(await response.json())
  if (!result.success) {
    throw new Error("Authentication returned an invalid response")
  }
  const data = result.data

  if (!response.ok || !data.preflightToken) {
    throw new Error(data.error ?? "Authentication failed")
  }

  return data.preflightToken
}

export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

export const getSafeRedirectPath = (
  redirect: string | null,
  origin: string
) => {
  if (!redirect) {
    return "/save"
  }
  try {
    const destination = new URL(redirect, origin)
    if (destination.origin !== origin || !redirect.startsWith("/")) {
      return "/save"
    }
    return `${destination.pathname}${destination.search}${destination.hash}`
  } catch {
    return "/save"
  }
}

export const redirectAfterAuth = () => {
  const params = new URLSearchParams(window.location.search)
  window.location.href = getSafeRedirectPath(
    params.get("redirect"),
    window.location.origin
  )
}

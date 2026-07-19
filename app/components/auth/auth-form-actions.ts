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
  const data = (await response.json()) as {
    preflightToken?: string
    error?: string
  }

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

export const redirectAfterAuth = () => {
  const params = new URLSearchParams(window.location.search)
  window.location.href = params.get("redirect") || "/save"
}

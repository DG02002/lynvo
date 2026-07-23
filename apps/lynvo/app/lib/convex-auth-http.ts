import { cookieSyncedAuthStorage } from "./convex-auth-storage"
import { authSignInResponseSchema } from "./auth-http-schema"

const jwtStorageKey = "__convexAuthJWT_lynvo"
const refreshTokenStorageKey = "__convexAuthRefreshToken_lynvo"

export async function signInWithConvexAuthHttp(
  _convexUrl: string,
  provider: string,
  params: Record<string, string>
) {
  const response = await fetch("/api/auth/sign-in", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, params }),
  })
  if (!response.ok) {
    const errorValue: unknown = await response.json()
    const errorResult = authSignInResponseSchema.safeParse(errorValue)
    throw new Error(
      errorResult.success
        ? (errorResult.data.error ?? "Authentication failed")
        : "Authentication failed"
    )
  }
  const responseValue: unknown = await response.json()
  const parsed = authSignInResponseSchema.safeParse(responseValue)
  if (!parsed.success) {
    throw new Error("Authentication returned an invalid response")
  }
  const result = parsed.data
  if (result.tokens) {
    cookieSyncedAuthStorage.setItem(jwtStorageKey, result.tokens.token)
    cookieSyncedAuthStorage.setItem(
      refreshTokenStorageKey,
      result.tokens.refreshToken
    )
  }

  return {
    signingIn: Boolean(result.tokens),
    redirect: result.redirect ? new URL(result.redirect) : undefined,
    started: result.started,
  }
}

import { cookieSyncedAuthStorage } from "./convex-auth-storage"

const jwtStorageKey = "__convexAuthJWT_lynvo"
const refreshTokenStorageKey = "__convexAuthRefreshToken_lynvo"

type AuthSignInResult = {
  tokens?: {
    token: string
    refreshToken: string
  } | null
  redirect?: string
  started?: boolean
}

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
  const result = (await response.json()) as AuthSignInResult & {
    error?: string
  }
  if (!response.ok) {
    throw new Error(result.error ?? "Authentication failed")
  }

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

import { authSignInResponseSchema } from "./auth-http-schema"
import { readApiResponseError } from "./api-errors"

export async function signInWithConvexAuthHttp(
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
    throw await readApiResponseError(response, "Authentication failed")
  }
  const responseValue: unknown = await response.json()
  const parsed = authSignInResponseSchema.safeParse(responseValue)
  if (!parsed.success) {
    throw new Error("Authentication returned an invalid response")
  }
  const result = parsed.data
  return {
    signingIn: result.signingIn ?? false,
    redirect: result.redirect ? new URL(result.redirect) : undefined,
    started: result.started,
  }
}

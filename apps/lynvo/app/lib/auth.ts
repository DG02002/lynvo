import { data, redirect } from "react-router"
import { Effect } from "effect"
import { AuthSessionService } from "./effect/services/AuthSessionService"
import { getRuntime } from "./effect/runtime"
import { getCookieValue, createSessionCookie, normalizeReturnTo } from "./auth-cookie"
import { WORKER_SESSION_COOKIE_NAME } from "./constants"

export interface SessionResult {
  readonly user: {
    readonly sub: string
    readonly username: string
    readonly sid: string
  } | null
  readonly sessionExpiresAt?: number
}

export const responseWithSession = <ResponseData>(
  responseData: ResponseData,
  sessionResult: SessionResult,
  request: Request,
  init?: ResponseInit
) => {
  const headers = new Headers(init?.headers)
  headers.set("Cache-Control", "no-store")
  const opaqueSessionId = getCookieValue(request, WORKER_SESSION_COOKIE_NAME)
  if (sessionResult.user && opaqueSessionId) {
    const maxAgeSeconds =
      sessionResult.sessionExpiresAt === undefined
        ? undefined
        : Math.max(
            0,
            Math.ceil((sessionResult.sessionExpiresAt - Date.now()) / 1_000)
          )
    headers.append(
      "Set-Cookie",
      createSessionCookie(opaqueSessionId, maxAgeSeconds)
    )
  }
  return data(responseData, { ...init, headers })
}

export const requireUserOrRedirect = (
  sessionResult: SessionResult,
  returnTo?: string
) => {
  if (!sessionResult.user) {
    const loginUrl = returnTo
      ? `/auth/log-in?redirect=${encodeURIComponent(returnTo)}`
      : "/auth/log-in"
    throw redirect(loginUrl)
  }
  return sessionResult.user
}

/**
 * Throws a redirect if the request already carries a valid session.
 * Use this in auth-page loaders (log-in, create-account, sign-in-with-another-device)
 * to prevent authenticated users from being served a form they don't need.
 *
 * Redirect priority:
 *   1. The `?redirect=` query param, if it resolves to a valid app-relative path.
 *   2. "/save" — the primary authenticated landing page.
 */
export const requireGuestOrRedirect = (
  sessionResult: SessionResult,
  request: Request
) => {
  if (sessionResult.user) {
    const url = new URL(request.url)
    const destination = normalizeReturnTo(
      url.searchParams.get("redirect") ?? undefined
    )
    throw redirect(destination === "/" ? "/save" : destination)
  }
}

export const getUserSession = async (
  request: Request,
  env: Env
): Promise<SessionResult> => {
  const result = await getRuntime(env).runPromise(
    Effect.flatMap(AuthSessionService, (authSession) =>
      authSession.getSession(request)
    )
  )
  if (result.kind === "unavailable") {
    throw data(
      { error: "Authentication is temporarily unavailable." },
      { status: 503 }
    )
  }
  return {
    user: result.user
      ? {
          sub: result.user.id,
          username: result.user.username,
          sid: result.user.sid,
        }
      : null,
    sessionExpiresAt: result.expiresAt,
  }
}

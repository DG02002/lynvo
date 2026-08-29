import { data, redirect } from "react-router"
import { getCookieValue, normalizeReturnTo } from "./auth-cookie"
import { getD1Database } from "../../workers/d1/db"
import {
  createD1SessionCookie,
  resolveSessionContext,
} from "../../workers/d1/sessions"
import { MILLISECONDS_PER_SECOND } from "./constants"
import { D1_SESSION_COOKIE_NAME } from "../../workers/constants"

export interface SessionResult {
  readonly user: {
    readonly sub: string
    readonly email: string
    readonly name?: string | null
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
  const opaqueSessionId = getCookieValue(request, D1_SESSION_COOKIE_NAME)
  if (sessionResult.user && opaqueSessionId) {
    const maxAgeSeconds =
      sessionResult.sessionExpiresAt === undefined
        ? undefined
        : Math.max(
            0,
            Math.ceil(
              (sessionResult.sessionExpiresAt - Date.now()) /
                MILLISECONDS_PER_SECOND
            )
          )
    headers.append(
      "Set-Cookie",
      createD1SessionCookie(opaqueSessionId, maxAgeSeconds)
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

export const getSessionContext = async (
  request: Request,
  env: Env
): Promise<{
  readonly user: {
    readonly id: string
    readonly email: string
    readonly name?: string | null
    readonly sid: string
  } | null
  readonly expiresAt?: number
  readonly available: boolean
}> => {
  const database = getD1Database(env)
  if (!database) {
    return { user: null, available: false }
  }
  const session = await resolveSessionContext(request, database, Date.now())
  return {
    user: session
      ? {
          id: session.userId,
          email: session.email,
          name: session.displayName,
          sid: session.sessionId,
        }
      : null,
    expiresAt: session?.expiresAt,
    available: true,
  }
}

export const getUserSession = async (
  request: Request,
  env: Env
): Promise<SessionResult> => {
  const result = await getSessionContext(request, env)
  if (!result.available) {
    throw data(
      { error: "Authentication is temporarily unavailable." },
      { status: 503 }
    )
  }
  return {
    user: result.user
      ? {
          sub: result.user.id,
          email: result.user.email,
          name: result.user.name,
          sid: result.user.sid,
        }
      : null,
    sessionExpiresAt: result.expiresAt,
  }
}

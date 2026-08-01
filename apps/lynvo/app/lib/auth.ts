import { data, redirect } from "react-router"
import { Effect } from "effect"
import { AuthSessionService } from "./effect/services/AuthSessionService"
import { getRuntime } from "./effect/runtime"

export interface SessionResult {
  readonly user: {
    readonly sub: string
    readonly username: string
    readonly sid: string
  } | null
}

export const responseWithSession = <ResponseData>(
  responseData: ResponseData,
  sessionResult: SessionResult,
  request: Request,
  init?: ResponseInit
) => {
  const headers = new Headers(init?.headers)
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
  }
}

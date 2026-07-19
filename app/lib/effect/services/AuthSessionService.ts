import { Context, Effect, Layer } from "effect"
import { ConvexService } from "./ConvexService"
import { api } from "../../../../convex/_generated/api"
import { AUTH_JWT_COOKIE_NAME } from "../../constants"
import { getCookieValue } from "../../auth-cookie"

export interface SessionUser {
  readonly id: string
  readonly username: string
  readonly sid: string
}

export interface SessionResult {
  readonly user: SessionUser | null
  readonly accessToken?: string
}

export interface AuthSessionServiceShape {
  readonly getSession: (request: Request) => Effect.Effect<SessionResult>
}

export class AuthSessionService extends Context.Service<
  AuthSessionService,
  AuthSessionServiceShape
>()("app/effect/services/AuthSessionService") {
  static readonly layer = Layer.effect(
    AuthSessionService,
    Effect.gen(function* () {
      const convex = yield* ConvexService

      const getSession = Effect.fn("AuthSessionService.getSession")(function* (
        request: Request
      ): Effect.fn.Return<SessionResult> {
        const accessToken = getCookieValue(request, AUTH_JWT_COOKIE_NAME)
        if (!accessToken) {
          return { user: null }
        }

        const user = yield* convex
          .query(api.users.getMe, {}, { accessToken })
          .pipe(
            Effect.catch((error) =>
              Effect.logWarning("Convex Auth session validation failed", {
                error: error.message,
              }).pipe(Effect.as(null))
            )
          )

        if (!user) {
          return { user: null }
        }

        return {
          user: {
            id: user._id,
            username: user.username,
            sid: accessToken,
          },
          accessToken,
        }
      })

      return AuthSessionService.of({ getSession })
    })
  )
}

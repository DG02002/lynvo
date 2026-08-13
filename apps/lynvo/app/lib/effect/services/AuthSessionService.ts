import { Context, Effect, Layer } from "effect"
import { ConvexService } from "./ConvexService"
import { api } from "../../../../convex/_generated/api"
import { WORKER_SESSION_COOKIE_NAME } from "../../constants"
import { getCookieValue } from "../../auth-cookie"
import { CloudflareEnv } from "./CloudflareEnv"
import { createAuthSessionModule } from "../../../../workers/auth-session"

export interface SessionUser {
  readonly id: string
  readonly username: string
  readonly sid: string
}

export interface SessionResult {
  readonly kind: "authenticated" | "unauthenticated" | "unavailable"
  readonly user: SessionUser | null
  readonly accessToken?: string
}

export interface AuthSessionServiceContract {
  readonly getSession: (request: Request) => Effect.Effect<SessionResult>
}

export class AuthSessionService extends Context.Service<
  AuthSessionService,
  AuthSessionServiceContract
>()("app/effect/services/AuthSessionService") {
  static readonly layer = Layer.effect(
    AuthSessionService,
    Effect.gen(function* () {
      const convex = yield* ConvexService
      const environment = yield* CloudflareEnv

      const resolveSession = Effect.fn("AuthSessionService.resolveSession")(
        function* (request: Request): Effect.fn.Return<SessionResult> {
          const opaqueSessionId = getCookieValue(
            request,
            WORKER_SESSION_COOKIE_NAME
          )
          if (!opaqueSessionId) {
            return { kind: "unauthenticated", user: null }
          }
          const authSession = createAuthSessionModule(
            environment.WORKER_AUTH_SESSION
          )
          const storedSession = yield* Effect.promise(() =>
            authSession.read(opaqueSessionId)
          )
          if (storedSession.kind === "unavailable") {
            return { kind: "unavailable", user: null }
          }
          if (storedSession.kind !== "active") {
            return { kind: "unauthenticated", user: null }
          }

          const validate = (accessToken: string) =>
            convex.query(api.users.getSessionUser, {}, { accessToken })
          let accessToken = storedSession.session.accessToken
          let user = yield* Effect.option(validate(accessToken))
          if (user._tag === "None" || user.value === null) {
            const rotation = yield* Effect.promise(() =>
              authSession.rotate({
                sessionId: opaqueSessionId,
                refresh: async (refreshToken) => {
                  const refreshed = await Effect.runPromise(
                    convex.action(api.auth.signIn, { refreshToken })
                  )
                  return refreshed.tokens
                    ? {
                        accessToken: refreshed.tokens.token,
                        refreshToken: refreshed.tokens.refreshToken,
                      }
                    : undefined
                },
              })
            )
            if (rotation.kind === "unavailable") {
              return { kind: "unavailable", user: null }
            }
            if (rotation.kind !== "rotated") {
              return { kind: "unauthenticated", user: null }
            }
            const rotatedSession = yield* Effect.promise(() =>
              authSession.read(opaqueSessionId)
            )
            if (rotatedSession.kind !== "active") {
              return {
                kind:
                  rotatedSession.kind === "unavailable"
                    ? "unavailable"
                    : "unauthenticated",
                user: null,
              }
            }
            accessToken = rotatedSession.session.accessToken
            user = yield* Effect.option(validate(accessToken))
          }

          if (user._tag === "None" || user.value === null) {
            return { kind: "unavailable", user: null }
          }
          const authenticatedUser = user.value

          yield* Effect.promise(() =>
            authSession.touchActivityWhenDue({
              sessionId: opaqueSessionId,
              nowMs: Date.now(),
              touch: () =>
                Effect.runPromise(
                  convex.mutation(api.users.touchActivity, {}, { accessToken })
                ).then(() => undefined),
            })
          )

          return {
            kind: "authenticated",
            user: {
              id: authenticatedUser.id,
              username: authenticatedUser.username,
              sid: authenticatedUser.sessionId,
            },
            accessToken,
          }
        }
      )

      const sessionRequests = new WeakMap<Request, Promise<SessionResult>>()
      const getSession = (request: Request) => {
        const activeRequest = sessionRequests.get(request)
        if (activeRequest) {
          return Effect.promise(() => activeRequest)
        }
        const requestPromise = Effect.runPromise(resolveSession(request))
        sessionRequests.set(request, requestPromise)
        return Effect.promise(() => requestPromise)
      }

      return AuthSessionService.of({ getSession })
    })
  )
}

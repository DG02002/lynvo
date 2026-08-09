import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { api } from "../../../../../convex/_generated/api"
import { Api } from "../Api"
import { CurrentUser } from "../Middleware"
import { ConvexService } from "../../services/ConvexService"
import { normalizePlayerPreferences } from "../../../player-utils"
import { CloudflareEnv } from "../../services/CloudflareEnv"
import { ConvexError } from "../../errors"
import { createAuthSessionModule } from "../../../../../workers/auth-session"
import { createSignedInSessionLifecycle } from "../../../../../workers/signed-in-session-lifecycle"
import type { RevokeSignedInSessionsInput } from "../../../../../workers/signed-in-session-lifecycle"

const runSignedInSessionLifecycle = (operation: RevokeSignedInSessionsInput) =>
  Effect.gen(function* () {
    const environment = yield* CloudflareEnv
    const result = yield* Effect.promise(() =>
      createSignedInSessionLifecycle(
        createAuthSessionModule(environment.WORKER_AUTH_SESSION)
      ).revoke(operation)
    )
    if (result.kind === "unavailable") {
      return yield* new ConvexError({
        message: "Session revocation is unavailable",
      })
    }
  })

export const SettingsHandlers = HttpApiBuilder.group(
  Api,
  "settings",
  (handlers) =>
    handlers
      .handle("touchActivity", ({ payload }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          yield* Effect.all([
            convex.mutation(
              api.users.touchActivity,
              {},
              {
                accessToken: user.accessToken,
              }
            ),
            convex.mutation(
              api.users.setCurrentSessionDevice,
              { deviceName: payload.deviceName },
              { accessToken: user.accessToken }
            ),
          ])
          return { success: true }
        })
      )
      .handle("getPlayerPreferences", () =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          const preferences = yield* convex.query(
            api.users.getPlayerPreferences,
            {},
            { accessToken: user.accessToken }
          )
          return normalizePlayerPreferences(preferences)
        })
      )
      .handle("updatePlayerPreferences", ({ payload }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          yield* convex.mutation(api.users.updatePlayerPreferences, payload, {
            accessToken: user.accessToken,
          })
          return { success: true }
        })
      )
      .handle("getStorageUsage", () =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          return yield* convex.query(
            api.users.getStorageUsage,
            {},
            { accessToken: user.accessToken }
          )
        })
      )
      .handle("previewStorageRetention", ({ query }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          return yield* convex.query(
            api.users.previewStorageRetentionDays,
            query,
            { accessToken: user.accessToken }
          )
        })
      )
      .handle("updateStorageRetention", ({ payload }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          return yield* convex.mutation(
            api.users.updateStorageRetentionDays,
            payload,
            { accessToken: user.accessToken }
          )
        })
      )
      .handle("clearLinks", () =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          return yield* convex.mutation(
            api.users.clearLinks,
            {},
            { accessToken: user.accessToken }
          )
        })
      )
      .handle("listSessions", () =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          return yield* convex.query(
            api.users.listSessions,
            {},
            { accessToken: user.accessToken }
          )
        })
      )
      .handle("revokeSession", ({ params }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          yield* runSignedInSessionLifecycle({
            prepare: () =>
              Effect.runPromise(
                convex
                  .query(
                    api.users.prepareSessionRevocation,
                    { sessionId: params.sessionId },
                    { accessToken: user.accessToken }
                  )
                  .pipe(Effect.map((result) => result.workerSessionIds))
              ),
            commit: () =>
              Effect.runPromise(
                convex.mutation(
                  api.users.revokeSession,
                  { sessionId: params.sessionId },
                  { accessToken: user.accessToken }
                )
              ).then(() => undefined),
          })
          return { success: true }
        })
      )
      .handle("revokeAllSessions", () =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          yield* runSignedInSessionLifecycle({
            prepare: () =>
              Effect.runPromise(
                convex
                  .query(
                    api.users.prepareAllSessionRevocations,
                    {},
                    {
                      accessToken: user.accessToken,
                    }
                  )
                  .pipe(Effect.map((result) => result.workerSessionIds))
              ),
            commit: () =>
              Effect.runPromise(
                convex.mutation(
                  api.users.revokeAllSessions,
                  {},
                  {
                    accessToken: user.accessToken,
                  }
                )
              ).then(() => undefined),
          })
          return { success: true }
        })
      )
      .handle("deleteAccount", ({ payload }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          const result = yield* Effect.promise(() =>
            createSignedInSessionLifecycle(
              createAuthSessionModule(environment.WORKER_AUTH_SESSION)
            ).eraseAccount({
              prepare: () =>
                Effect.runPromise(
                  convex
                    .query(
                      api.users.prepareAllSessionRevocations,
                      {},
                      {
                        accessToken: user.accessToken,
                      }
                    )
                    .pipe(Effect.map((prepared) => prepared.workerSessionIds))
                ),
              commit: async () => undefined,
              eraseAccount: () =>
                Effect.runPromise(
                  convex.action(api.users.deleteAccount, payload, {
                    accessToken: user.accessToken,
                  })
                ).then(() => undefined),
            })
          )
          if (result.kind === "unavailable") {
            return yield* new ConvexError({
              message: "Account erasure is unavailable",
            })
          }
          return { success: true }
        })
      )
      .handle("getLynvoUsage", ({ query }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          return yield* convex.query(api.usage.getUsage, query, {
            accessToken: user.accessToken,
          })
        })
      )
      .handle("changePassword", ({ payload }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          return yield* convex.action(api.users.changePassword, payload, {
            accessToken: user.accessToken,
          })
        })
      )
)

import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { api } from "../../../../../convex/_generated/api"
import { Api } from "../Api"
import { CurrentUser } from "../Middleware"
import { ConvexService } from "../../services/ConvexService"
import type { ConvexServiceShape } from "../../services/ConvexService"
import { normalizePlayerPreferences } from "../../../player-utils"
import { CloudflareEnv } from "../../services/CloudflareEnv"
import { createSavedLinkRealtimeDelivery } from "../../../../../workers/saved-link-realtime-delivery"
import { createDurableRealtimeSessionRevocation } from "../../../../../workers/realtime-session-revocation"
import { createAccountSettingsRealtimeDelivery } from "../../../../../workers/account-settings-realtime-delivery"
import { ConvexError } from "../../errors"
import { createAuthSessionModule } from "../../../../../workers/auth-session"
import { createSignedInSessionLifecycle } from "../../../../../workers/signed-in-session-lifecycle"
import { createSessionCleanupModule } from "../../../../../workers/session-cleanup"

const getSignedInSessionLifecycle = (
  convex: ConvexServiceShape,
  accessToken: string,
  environment: Cloudflare.Env,
  onSessionsRevoked?: (sessionIds: readonly string[]) => void
) =>
  createSignedInSessionLifecycle(
    createAuthSessionModule(environment.WORKER_AUTH_SESSION),
    {
      revokeSession: (sessionId) =>
        Effect.runPromise(
          convex
            .mutation(api.users.revokeSession, { sessionId }, { accessToken })
            .pipe(Effect.map((result) => result.workerSessionIds))
        ),
      revokeAllSessions: () =>
        Effect.runPromise(
          convex
            .mutation(api.users.revokeAllSessions, {}, { accessToken })
            .pipe(
              Effect.map((result) => {
                onSessionsRevoked?.(result.sessionIds)
                return result.workerSessionIds
              })
            )
        ),
      beginAccountErasure: (confirmUsername) =>
        Effect.runPromise(
          convex
            .mutation(
              api.users.beginAccountErasure,
              { confirmUsername },
              { accessToken }
            )
            .pipe(Effect.map((result) => result.workerSessionIds))
        ),
    },
    createSessionCleanupModule(environment)
  )

const runSignedInSessionLifecycle = (
  operation: () => Promise<{ readonly kind: "completed" | "unavailable" }>
) =>
  Effect.gen(function* () {
    const result = yield* Effect.promise(operation)
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
          const result = yield* convex.mutation(
            api.users.updatePlayerPreferences,
            payload,
            { accessToken: user.accessToken }
          )
          const environment = yield* CloudflareEnv
          yield* Effect.promise(() =>
            createAccountSettingsRealtimeDelivery(environment).deliver(
              user.id,
              result.revision
            )
          )
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
          const result = yield* convex.mutation(
            api.users.updateStorageRetentionDays,
            payload,
            { accessToken: user.accessToken }
          )
          const revision = result.revision
          if (revision !== null) {
            const environment = yield* CloudflareEnv
            yield* Effect.promise(() =>
              createSavedLinkRealtimeDelivery(environment).deliver(
                user.id,
                revision
              )
            )
          }
          return { success: true, deletedLinks: result.deletedLinks }
        })
      )
      .handle("clearLinks", () =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          const result = yield* convex.mutation(
            api.users.clearLinks,
            {},
            { accessToken: user.accessToken }
          )
          const revision = result.revision
          if (revision !== null) {
            const environment = yield* CloudflareEnv
            yield* Effect.promise(() =>
              createSavedLinkRealtimeDelivery(environment).deliver(
                user.id,
                revision
              )
            )
          }
          return { success: true, deletedLinks: result.deletedLinks }
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
          const environment = yield* CloudflareEnv
          const lifecycle = getSignedInSessionLifecycle(
            convex,
            user.accessToken,
            environment
          )
          yield* runSignedInSessionLifecycle(() =>
            lifecycle.revokeSession(params.sessionId)
          )
          yield* Effect.promise(() =>
            createDurableRealtimeSessionRevocation(environment).deliver({
              userId: user.id,
              sessionId: params.sessionId,
            })
          )
          return { success: true }
        })
      )
      .handle("revokeAllSessions", () =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          let revokedSessionIds: readonly string[] = []
          const lifecycle = getSignedInSessionLifecycle(
            convex,
            user.accessToken,
            environment,
            (sessionIds) => {
              revokedSessionIds = sessionIds
            }
          )
          yield* runSignedInSessionLifecycle(lifecycle.revokeAllSessions)
          yield* Effect.promise(() =>
            Promise.all(
              revokedSessionIds.map((sessionId) =>
                createDurableRealtimeSessionRevocation(environment).deliver({
                  userId: user.id,
                  sessionId,
                })
              )
            )
          )
          return { success: true }
        })
      )
      .handle("deleteAccount", ({ payload }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          const lifecycle = getSignedInSessionLifecycle(
            convex,
            user.accessToken,
            environment
          )
          const result = yield* Effect.promise(() =>
            lifecycle.eraseAccount(payload.confirmUsername)
          )
          if (result.kind === "unavailable") {
            return yield* new ConvexError({
              message: "Account erasure is unavailable",
            })
          }
          yield* Effect.promise(() =>
            createDurableRealtimeSessionRevocation(environment).deliver({
              userId: user.id,
            })
          )
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
          const result = yield* convex.action(
            api.users.changePassword,
            payload,
            {
              accessToken: user.accessToken,
            }
          )
          const environment = yield* CloudflareEnv
          yield* Effect.promise(() =>
            Promise.all(
              result.sessionIds.map((sessionId) =>
                createDurableRealtimeSessionRevocation(environment).deliver({
                  userId: user.id,
                  sessionId,
                })
              )
            )
          )
          return { success: true }
        })
      )
)

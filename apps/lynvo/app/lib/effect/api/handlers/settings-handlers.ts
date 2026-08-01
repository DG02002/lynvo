import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { api } from "../../../../../convex/_generated/api"
import { Api } from "../Api"
import { CurrentUser } from "../Middleware"
import { ConvexService } from "../../services/ConvexService"
import { normalizePlayerPreferences } from "../../../player-utils"
import { CloudflareEnv } from "../../services/CloudflareEnv"
import { ConvexError } from "../../errors"

const revokeWorkerSessions = (workerSessionIds: readonly string[]) =>
  Effect.gen(function* () {
    const environment = yield* CloudflareEnv
    yield* Effect.forEach(workerSessionIds, (workerSessionId) =>
      Effect.tryPromise({
        try: async () => {
          const response = await environment.WORKER_AUTH_SESSION.getByName(
            workerSessionId
          ).fetch("https://session.internal/session", { method: "DELETE" })
          if (!response.ok) {
            throw new Error("Worker session revocation failed")
          }
        },
        catch: () =>
          new ConvexError({ message: "Session revocation is unavailable" }),
      })
    )
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
      .handle("clearRecentLinks", () =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          return yield* convex.mutation(
            api.users.clearRecentCards,
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
          const result = yield* convex.mutation(
            api.users.revokeSession,
            { sessionId: params.sessionId },
            { accessToken: user.accessToken }
          )
          yield* revokeWorkerSessions(result.workerSessionIds)
          return { success: true }
        })
      )
      .handle("revokeAllSessions", () =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          const result = yield* convex.mutation(
            api.users.revokeAllSessions,
            {},
            { accessToken: user.accessToken }
          )
          yield* revokeWorkerSessions(result.workerSessionIds)
          return { success: true }
        })
      )
      .handle("deleteAccount", ({ payload }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          return yield* convex.action(api.users.deleteAccount, payload, {
            accessToken: user.accessToken,
          })
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

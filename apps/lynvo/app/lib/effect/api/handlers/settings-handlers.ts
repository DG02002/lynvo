import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { api } from "../../../../../convex/_generated/api"
import { Api } from "../Api"
import { CurrentUser } from "../Middleware"
import { ConvexService } from "../../services/ConvexService"
import { normalizePlayerPreferences } from "../../../player-utils"

export const SettingsHandlers = HttpApiBuilder.group(
  Api,
  "settings",
  (handlers) =>
    handlers
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
          return yield* convex.mutation(
            api.users.revokeSession,
            { sessionId: params.sessionId },
            { accessToken: user.accessToken }
          )
        })
      )
      .handle("revokeAllSessions", () =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          return yield* convex.mutation(
            api.users.revokeAllSessions,
            {},
            { accessToken: user.accessToken }
          )
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
)

import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"

import {
  drainAccountErasures,
  initiateAccountErasure,
} from "../../../../../workers/d1/account-erasure"
import {
  findSessionOwnerById,
  listSessionsForUser,
  revokeAllSessionsForUser,
  revokeSessionById,
  touchSessionActivity,
} from "../../../../../workers/d1/sessions"
import {
  getUserById,
  getUserPlayerPreferences,
  updateUserPlayerPreferences,
} from "../../../../../workers/d1/users"
import {
  closeRealtimeAccount,
  closeRealtimeSession,
} from "../../../../../workers/realtime-session-revocation"
import { normalizePlayerPreferences } from "../../../player-utils"
import { BackendError, NotFoundError, ValidationError } from "../../errors"
import {
  ACCOUNT_DATA_UNAVAILABLE_MESSAGE,
  requireDatabaseEffect,
} from "../../require-database"
import { CloudflareEnv } from "../../services/cloudflare-env"
import { Api } from "../api"
import { CurrentUser } from "../middleware"
import { versionedSuccess } from "../versioned-response"

export const SettingsHandlers = HttpApiBuilder.group(
  Api,
  "settings",
  (handlers) =>
    handlers
      .handle("touchActivity", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          const database = yield* requireDatabaseEffect(
            environment,
            ACCOUNT_DATA_UNAVAILABLE_MESSAGE
          )
          yield* Effect.tryPromise({
            try: () =>
              touchSessionActivity(database, user.sid, {
                deviceName: payload.deviceName,
                now: Date.now(),
              }),
            catch: (cause) =>
              new BackendError({
                message: "Activity touch failed",
                cause,
              }),
          })
          return { success: true }
        })
      )
      .handle("getPlayerPreferences", () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          const database = yield* requireDatabaseEffect(
            environment,
            ACCOUNT_DATA_UNAVAILABLE_MESSAGE
          )
          const preferences = yield* Effect.tryPromise({
            try: () => getUserPlayerPreferences(database, user.id),
            catch: (cause) =>
              new BackendError({
                message: "Player preferences are unavailable",
                cause,
              }),
          })
          return normalizePlayerPreferences(preferences)
        })
      )
      .handle("updatePlayerPreferences", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          const database = yield* requireDatabaseEffect(
            environment,
            ACCOUNT_DATA_UNAVAILABLE_MESSAGE
          )
          const { dataVersion } = yield* Effect.tryPromise({
            try: () =>
              updateUserPlayerPreferences(database, user.id, {
                ...payload,
                now: Date.now(),
              }),
            catch: (cause) =>
              new BackendError({
                message:
                  cause instanceof Error
                    ? cause.message
                    : "Player preferences could not be updated",
                cause,
              }),
          })
          return versionedSuccess(dataVersion)
        })
      )
      .handle("listSessions", () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          const database = yield* requireDatabaseEffect(
            environment,
            ACCOUNT_DATA_UNAVAILABLE_MESSAGE
          )
          return yield* Effect.tryPromise({
            try: () =>
              listSessionsForUser({
                database,
                userId: user.id,
                currentSessionId: user.sid,
                now: Date.now(),
              }),
            catch: (cause) =>
              new BackendError({
                message: ACCOUNT_DATA_UNAVAILABLE_MESSAGE,
                cause,
              }),
          })
        })
      )
      .handle("revokeSession", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          const database = yield* requireDatabaseEffect(
            environment,
            ACCOUNT_DATA_UNAVAILABLE_MESSAGE
          )
          const ownerId = yield* Effect.promise(() =>
            findSessionOwnerById(database, params.sessionId)
          )
          if (ownerId !== user.id) {
            return yield* new NotFoundError({ message: "Session not found" })
          }
          yield* Effect.tryPromise({
            try: async () => {
              await revokeSessionById(database, params.sessionId, Date.now())
              await closeRealtimeSession(environment, user.id, params.sessionId)
            },
            catch: (cause) =>
              new BackendError({
                message: "The session couldn’t be logged out",
                cause,
              }),
          })
          return { success: true }
        })
      )
      .handle("revokeAllSessions", () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          const database = yield* requireDatabaseEffect(
            environment,
            ACCOUNT_DATA_UNAVAILABLE_MESSAGE
          )
          yield* Effect.tryPromise({
            try: async () => {
              await revokeAllSessionsForUser(database, user.id, Date.now())
              await closeRealtimeAccount(environment, user.id)
            },
            catch: (cause) =>
              new BackendError({
                message: "The sessions couldn’t be logged out",
                cause,
              }),
          })
          return { success: true }
        })
      )
      .handle("deleteAccount", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          const database = yield* requireDatabaseEffect(
            environment,
            ACCOUNT_DATA_UNAVAILABLE_MESSAGE
          )
          const account = yield* Effect.promise(() =>
            getUserById(database, user.id)
          )
          if (!account) {
            return yield* new BackendError({
              message: "Authentication required",
            })
          }
          if (payload.confirmEmail.trim() !== account.email) {
            return yield* new ValidationError({
              message: "Email does not match",
            })
          }
          const now = Date.now()
          yield* Effect.tryPromise({
            try: async () => {
              await initiateAccountErasure(database, user.id, {
                trigger: "manual",
                now,
              })
              await drainAccountErasures(database, user.id)
              await closeRealtimeAccount(environment, user.id)
            },
            catch: (cause) =>
              new BackendError({
                message: "The account couldn’t be deleted",
                cause,
              }),
          })
          return { success: true }
        })
      )
)

import { Effect, Result, Schema } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../api"
import { CurrentUser } from "../middleware"
import { CloudflareEnv } from "../../services/cloudflare-env"
import { parseRemoteTargetId } from "../../../remote-target"
import { BackendError } from "../../errors"
import { getD1Database } from "../../../../../workers/d1/db"
import {
  claimNextRemoteCommand,
  enqueueRemoteCommand,
  reportRemoteCommandResult,
} from "../../../../../workers/d1/remote-commands"
import { createRemoteCommandNotificationDelivery } from "../../../../../workers/remote-command-notification-delivery"

const remotePresenceSchema = Schema.Struct({
  receivers: Schema.Array(Schema.Struct({ id: Schema.String })),
})

export const RemoteHandlers = HttpApiBuilder.group(Api, "remote", (handlers) =>
  handlers
    .handle("send", ({ payload }) =>
      Effect.gen(function* () {
        const environment = yield* CloudflareEnv
        const user = yield* CurrentUser
        const database = getD1Database(environment)
        if (!database) {
          return yield* new BackendError({
            message: "Remote commands are temporarily unavailable",
          })
        }
        const commandPayload = payload.data
          ? JSON.stringify(payload.data)
          : "{}"
        const target = parseRemoteTargetId(payload.target_session_id)
        if (!target) {
          return yield* new BackendError({
            message: "Remote receiver target is invalid",
          })
        }
        const presence: unknown = yield* Effect.tryPromise({
          try: async () => {
            const response = await environment.USER_REALTIME_ROOM.getByName(
              user.id
            ).fetch("https://realtime.internal/receivers")
            return await response.json()
          },
          catch: (cause) =>
            new BackendError({
              message: "Remote receiver presence is unavailable",
              cause,
            }),
        })
        const parsedPresence =
          Schema.decodeUnknownResult(remotePresenceSchema)(presence)
        const receiverIsLive =
          Result.isSuccess(parsedPresence) &&
          parsedPresence.success.receivers.some(
            (receiver) => receiver.id === payload.target_session_id
          )
        if (!receiverIsLive) {
          return yield* new BackendError({
            message: "Remote receiver is offline",
          })
        }
        const enqueued = yield* Effect.tryPromise({
          try: () =>
            enqueueRemoteCommand(database, user.id, {
              targetSessionId: target.sessionId,
              targetReceiverId: target.receiverId,
              command: payload.command,
              payload: commandPayload,
              now: Date.now(),
            }),
          catch: (cause) =>
            new BackendError({
              message:
                cause instanceof Error
                  ? cause.message
                  : "The remote command couldn’t be sent",
              cause,
            }),
        })
        yield* Effect.promise(() =>
          createRemoteCommandNotificationDelivery(environment, database)
            .deliver({
              commandId: enqueued.id,
              userId: user.id,
              receiverId: target.receiverId,
            })
            .catch(() => ({ kind: "unavailable" as const }))
        )
        return { success: true }
      })
    )
    .handle("pollInbox", ({ query }) =>
      Effect.gen(function* () {
        const environment = yield* CloudflareEnv
        const user = yield* CurrentUser
        const database = getD1Database(environment)
        if (!database) {
          return yield* new BackendError({
            message: "Remote commands are temporarily unavailable",
          })
        }
        const claim = yield* Effect.tryPromise({
          try: () =>
            claimNextRemoteCommand(database, user.id, user.sid, {
              receiverId: query.receiverId,
              now: Date.now(),
            }),
          catch: (cause) =>
            new BackendError({
              message: "The remote inbox is temporarily unavailable",
              cause,
            }),
        })
        return {
          commands: claim
            ? [
                {
                  id: claim.id,
                  claimToken: claim.claimToken,
                  command: claim.command,
                  payload: claim.payload,
                  createdAt: claim.createdAt,
                },
              ]
            : [],
        }
      })
    )
    .handle("reportResult", ({ payload }) =>
      Effect.gen(function* () {
        const environment = yield* CloudflareEnv
        const user = yield* CurrentUser
        const database = getD1Database(environment)
        if (!database) {
          return yield* new BackendError({
            message: "Remote commands are temporarily unavailable",
          })
        }
        yield* Effect.tryPromise({
          try: () =>
            reportRemoteCommandResult(database, user.id, user.sid, {
              id: payload.id,
              receiverId: payload.receiverId,
              claimToken: payload.claimToken,
              result: payload.result,
              message: payload.message,
              now: Date.now(),
            }),
          catch: (cause) =>
            new BackendError({
              message:
                cause instanceof Error
                  ? cause.message
                  : "The remote result could not be reported",
              cause,
            }),
        })
        return { success: true }
      })
    )
)

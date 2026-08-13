import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../Api"
import { CurrentUser } from "../Middleware"
import { ConvexService } from "../../services/ConvexService"
import { api } from "../../../../../convex/_generated/api"
import { CloudflareEnv } from "../../services/CloudflareEnv"
import { parseRemoteTargetId } from "../../../remote-target"
import { ConvexError } from "../../errors"
import { createRemoteCommandNotificationDelivery } from "../../../../../workers/remote-command-notification-delivery"
import { z } from "zod"

const remotePresenceSchema = z.object({
  receivers: z.array(z.object({ id: z.string() })),
})

export const RemoteHandlers = HttpApiBuilder.group(Api, "remote", (handlers) =>
  handlers
    .handle("send", ({ payload }) =>
      Effect.gen(function* () {
        const convex = yield* ConvexService
        const environment = yield* CloudflareEnv
        const user = yield* CurrentUser
        const commandPayload = payload.data
          ? JSON.stringify(payload.data)
          : "{}"
        const target = parseRemoteTargetId(payload.target_session_id)
        if (!target) {
          return yield* Effect.fail(
            new ConvexError({ message: "Remote receiver target is invalid" })
          )
        }
        const presence: unknown = yield* Effect.tryPromise({
          try: async () => {
            const response = await environment.USER_REALTIME_ROOM.getByName(
              user.id
            ).fetch("https://realtime.internal/receivers")
            return await response.json()
          },
          catch: (cause) =>
            new ConvexError({
              message: "Remote receiver presence is unavailable",
              cause,
            }),
        })
        const parsedPresence = remotePresenceSchema.safeParse(presence)
        const receiverIsLive =
          parsedPresence.success &&
          parsedPresence.data.receivers.some(
            (receiver) => receiver.id === payload.target_session_id
          )
        if (!receiverIsLive) {
          return yield* Effect.fail(
            new ConvexError({ message: "Remote receiver is offline" })
          )
        }
        const commandId = yield* convex.mutation(
          api.commands.enqueue,
          {
            targetSessionId: target.sessionId,
            targetReceiverId: target.receiverId,
            command: payload.command,
            payload: commandPayload,
          },
          { accessToken: user.accessToken }
        )
        yield* Effect.promise(() =>
          createRemoteCommandNotificationDelivery(environment).deliver({
            commandId,
            userId: user.id,
            receiverId: target.receiverId,
          })
        )
        return { success: true }
      })
    )
    .handle("pollInbox", ({ query }) =>
      Effect.gen(function* () {
        const convex = yield* ConvexService
        const user = yield* CurrentUser
        const command = yield* convex.mutation(
          api.commands.claimNext,
          { receiverId: query.receiverId },
          { accessToken: user.accessToken }
        )
        return {
          commands: command
            ? [
                {
                  id: command.id,
                  claimToken: command.claimToken,
                  command: command.command,
                  payload: command.payload,
                  createdAt: command.createdAt,
                },
              ]
            : [],
        }
      })
    )
    .handle("reportResult", ({ payload }) =>
      Effect.gen(function* () {
        const convex = yield* ConvexService
        const user = yield* CurrentUser
        return yield* convex.mutation(
          api.commands.reportResult,
          {
            id: payload.id,
            claimToken: payload.claimToken,
            receiverId: payload.receiverId,
            result: payload.result,
            message: payload.message,
          },
          { accessToken: user.accessToken }
        )
      })
    )
)

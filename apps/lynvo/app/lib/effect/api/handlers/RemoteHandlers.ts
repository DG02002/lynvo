import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../Api"
import { CurrentUser } from "../Middleware"
import { ConvexService } from "../../services/ConvexService"
import { api } from "../../../../../convex/_generated/api"
import type { Id } from "../../../../../convex/_generated/dataModel"
import { CloudflareEnv } from "../../services/CloudflareEnv"

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
        const commandId = yield* convex.mutation(
          api.commands.enqueue,
          {
            targetSessionId: payload.target_session_id as Id<"authSessions">,
            command: payload.command,
            payload: commandPayload,
          },
          { accessToken: user.accessToken }
        )
        yield* Effect.tryPromise(() =>
          environment.USER_REALTIME_ROOM.getByName(user.id).fetch(
            "https://realtime.internal/broadcast",
            {
              method: "POST",
              body: JSON.stringify({
                kind: "command",
                id: commandId,
                command: payload.command,
                payload: commandPayload,
                createdAt: Date.now(),
                targetSessionId: payload.target_session_id,
              }),
            }
          )
        ).pipe(Effect.ignore)
        return { success: true }
      })
    )
    .handle("pollInbox", () =>
      Effect.gen(function* () {
        const convex = yield* ConvexService
        const user = yield* CurrentUser
        const commands = yield* convex.query(
          api.commands.listForCurrentSession,
          {},
          { accessToken: user.accessToken }
        )
        return {
          commands: commands.map((command) => ({
            id: command._id,
            command: command.command,
            payload: command.payload,
            createdAt: command.createdAt,
          })),
        }
      })
    )
    .handle("acknowledge", ({ payload }) =>
      Effect.gen(function* () {
        const convex = yield* ConvexService
        const user = yield* CurrentUser
        return yield* convex.mutation(
          api.commands.acknowledge,
          { id: payload.id as Id<"remoteCommands"> },
          { accessToken: user.accessToken }
        )
      })
    )
)

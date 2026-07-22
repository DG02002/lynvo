import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../Api"
import { CurrentUser } from "../Middleware"
import { ConvexService } from "../../services/ConvexService"
import { api } from "../../../../../convex/_generated/api"
import type { Id } from "../../../../../convex/_generated/dataModel"

export const RemoteHandlers = HttpApiBuilder.group(Api, "remote", (handlers) =>
  handlers.handle("send", ({ payload }) =>
    Effect.gen(function* () {
      const convex = yield* ConvexService
      const user = yield* CurrentUser
      yield* convex.mutation(
        api.commands.enqueue,
        {
          targetSessionId: payload.target_session_id as Id<"authSessions">,
          command: payload.command,
          payload: payload.data ? JSON.stringify(payload.data) : "{}",
        },
        { accessToken: user.accessToken }
      )
      return { success: true }
    })
  )
)

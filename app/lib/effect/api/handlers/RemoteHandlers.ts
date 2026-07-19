import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../Api"
import { CurrentUser } from "../Middleware"
import { ConvexService } from "../../services/ConvexService"
import { api } from "../../../../../convex/_generated/api"

export const RemoteHandlers = HttpApiBuilder.group(Api, "remote", (handlers) =>
  handlers.handle("send", ({ payload }) =>
    Effect.gen(function* () {
      const convex = yield* ConvexService
      yield* CurrentUser // Verify user is logged in
      yield* convex.mutation(api.commands.push, {
        targetSessionId: payload.target_session_id,
        command: payload.command,
        payload: payload.data ? JSON.stringify(payload.data) : "{}",
      })
      return { success: true }
    })
  )
)

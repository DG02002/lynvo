import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { HttpServerResponse } from "effect/unstable/http"
import { Api } from "../Api"
import { CurrentUser } from "../Middleware"
import { ConvexService } from "../../services/ConvexService"
import { api } from "../../../../../convex/_generated/api"

export const DeviceAuthHandlers = HttpApiBuilder.group(
  Api,
  "device",
  (handlers) =>
    handlers
      .handle("status", ({ query }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          return yield* convex.query(api.deviceAuth.getStatus, query)
        })
      )
      .handle("approval", ({ query }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          return yield* convex.query(api.deviceAuth.getCodeForApproval, query, {
            accessToken: user.accessToken,
          })
        })
      )
      .handle("authorize", ({ payload }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          yield* convex.mutation(
            api.deviceAuth.authorizeCode,
            {
              code: payload.code,
            },
            { accessToken: user.accessToken }
          )
          return { success: true }
        })
      )
      .handle("exchange", ({ query }) =>
        Effect.gen(function* () {
          const response = yield* HttpServerResponse.json({
            success: true,
            code: query.code,
          }).pipe(Effect.orDie)
          return response
        })
      )
)

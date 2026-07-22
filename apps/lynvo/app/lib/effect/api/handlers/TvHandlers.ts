import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { HttpServerResponse } from "effect/unstable/http"
import { Api } from "../Api"
import { CurrentUser } from "../Middleware"
import { ConvexService } from "../../services/ConvexService"
import { api } from "../../../../../convex/_generated/api"

export const TvHandlers = HttpApiBuilder.group(Api, "tv", (handlers) =>
  handlers
    .handle("authorize", ({ payload }) =>
      Effect.gen(function* () {
        const convex = yield* ConvexService
        const user = yield* CurrentUser
        yield* convex.mutation(
          api.tv.authorizeCode,
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

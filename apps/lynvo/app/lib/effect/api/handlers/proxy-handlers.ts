import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"

import {
  readProxyProviderState,
  refreshProxyProviderBalance,
  saveProxyProviderKey,
} from "../../services/proxy-provider-key"
import { RequestEventService } from "../../services/request-event-service"
import { Api } from "../api"
import { CurrentUser } from "../middleware"
import { withDataVersionHeaders } from "../versioned-response"

export const ProxyHandlers = HttpApiBuilder.group(Api, "proxy", (handlers) =>
  handlers
    .handle("state", () =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        return yield* readProxyProviderState({ id: user.id })
      })
    )
    .handle("setKey", ({ payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const requestEvent = yield* RequestEventService
        requestEvent.add({
          operation: "proxy_provider_key",
          user_id: user.id,
        })
        const balance = yield* saveProxyProviderKey({
          token: payload.token,
          user,
        })
        return withDataVersionHeaders({ success: true, ...balance })
      })
    )
    .handle("refreshBalance", () =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const requestEvent = yield* RequestEventService
        requestEvent.add({
          operation: "proxy_provider_balance_refresh",
          user_id: user.id,
        })
        const result = yield* refreshProxyProviderBalance({ user })
        return withDataVersionHeaders(result)
      })
    )
)

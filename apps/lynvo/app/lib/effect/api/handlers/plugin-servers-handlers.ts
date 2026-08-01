import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../Api"
import { CurrentUser } from "../Middleware"
import { ConvexService } from "../../services/ConvexService"
import { api } from "../../../../../convex/_generated/api"
import { RequestEventService } from "../../services/request-event-service"
import {
  readCustomPluginServerUsage,
  refreshCustomPluginServer,
  registerCustomPluginServer,
} from "../../services/custom-plugin-server-lifecycle"

export const PluginServersHandlers = HttpApiBuilder.group(
  Api,
  "pluginServers",
  (handlers) =>
    handlers
      .handle("list", () =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          const requestEvent = yield* RequestEventService
          requestEvent.add({
            operation: "plugin_server_list",
            user_id: user.id,
          })
          return yield* convex.query(
            api.userPluginServers.list,
            {},
            {
              accessToken: user.accessToken,
            }
          )
        })
      )
      .handle("usage", () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return yield* readCustomPluginServerUsage({ user })
        })
      )
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const requestEvent = yield* RequestEventService
          requestEvent.add({
            operation: "plugin_server_create",
            user_id: user.id,
          })
          return yield* registerCustomPluginServer({
            baseUrl: payload.baseUrl,
            apiKey: payload.apiKey,
            requestId: requestEvent.requestId,
            user,
          })
        })
      )
      .handle("toggle", ({ params, payload }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          const requestEvent = yield* RequestEventService
          requestEvent.add({
            operation: "plugin_server_toggle",
            user_id: user.id,
            plugin_server_id: params.pluginServerId,
            plugin_server_enabled: payload.enabled,
          })
          yield* convex.mutation(
            api.userPluginServers.setEnabled,
            {
              id: params.pluginServerId,
              enabled: payload.enabled,
            },
            { accessToken: user.accessToken }
          )
          return { success: true }
        })
      )
      .handle("refresh", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const requestEvent = yield* RequestEventService
          requestEvent.add({
            operation: "plugin_server_refresh",
            user_id: user.id,
            plugin_server_id: params.pluginServerId,
          })
          return yield* refreshCustomPluginServer({
            pluginServerId: params.pluginServerId,
            requestId: requestEvent.requestId,
            user,
          })
        })
      )
      .handle("delete", ({ params }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          const requestEvent = yield* RequestEventService
          requestEvent.add({
            operation: "plugin_server_delete",
            user_id: user.id,
            plugin_server_id: params.pluginServerId,
          })
          yield* convex.mutation(
            api.userPluginServers.deleteById,
            {
              id: params.pluginServerId,
            },
            { accessToken: user.accessToken }
          )
          return { success: true }
        })
      )
)

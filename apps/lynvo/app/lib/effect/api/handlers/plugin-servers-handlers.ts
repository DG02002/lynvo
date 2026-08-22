import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../api"
import { CurrentUser } from "../middleware"
import { CloudflareEnv } from "../../services/cloudflare-env"
import { BackendError } from "../../errors"
import { RequestEventService } from "../../services/request-event-service"
import { getD1Database } from "../../../../../workers/d1/db"
import {
  deletePluginServerById,
  listPluginServers,
  setPluginServerEnabled,
} from "../../../../../workers/d1/plugin-servers"
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
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          const database = getD1Database(environment)
          const requestEvent = yield* RequestEventService
          requestEvent.add({
            operation: "plugin_server_list",
            user_id: user.id,
          })
          if (!database) {
            return yield* new BackendError({
              message: "Account data is temporarily unavailable",
            })
          }
          return yield* Effect.tryPromise({
            try: () => listPluginServers(database, user.id),
            catch: (cause) =>
              new BackendError({
                message: "Account data is temporarily unavailable",
                cause,
              }),
          })
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
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          const database = getD1Database(environment)
          const requestEvent = yield* RequestEventService
          requestEvent.add({
            operation: "plugin_server_toggle",
            user_id: user.id,
            plugin_server_id: params.pluginServerId,
            plugin_server_enabled: payload.enabled,
          })
          if (!database) {
            return yield* new BackendError({
              message: "Account data is temporarily unavailable",
            })
          }
          yield* Effect.tryPromise({
            try: () =>
              setPluginServerEnabled(database, user.id, {
                id: params.pluginServerId,
                enabled: payload.enabled,
                now: Date.now(),
              }),
            catch: (cause) =>
              new BackendError({
                message: "The plugin server couldn’t be updated",
                cause,
              }),
          })
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
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          const database = getD1Database(environment)
          const requestEvent = yield* RequestEventService
          requestEvent.add({
            operation: "plugin_server_delete",
            user_id: user.id,
            plugin_server_id: params.pluginServerId,
          })
          if (!database) {
            return yield* new BackendError({
              message: "Account data is temporarily unavailable",
            })
          }
          yield* Effect.tryPromise({
            try: () =>
              deletePluginServerById(database, user.id, {
                id: params.pluginServerId,
                now: Date.now(),
              }),
            catch: (cause) =>
              new BackendError({
                message:
                  cause instanceof Error
                    ? cause.message
                    : "The plugin server couldn’t be deleted",
                cause,
              }),
          })
          return { success: true }
        })
      )
)

import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../Api"
import { CurrentUser } from "../Middleware"
import { ConvexService } from "../../services/ConvexService"
import {
  preparePluginServerRefresh,
  preparePluginServerRegistration,
} from "../../services/plugin-server-registration"
import { api } from "../../../../../convex/_generated/api"
import { ConvexError, PluginServerRegistrationError } from "../../errors"
import { RequestEventService } from "../../services/request-event-service"
import { getCustomPluginServerUsage } from "../../services/custom-plugin-server-adapter"
import { PLUGIN_SERVER_VERIFICATION_STATUS } from "../../services/plugin-server-verification-status"
import { CloudflareEnv } from "../../services/CloudflareEnv"
import { signCredentialReadToken } from "../../../../lib/auth-gateway"
import { CREDENTIAL_READ_TOKEN_TTL_MS } from "../../../../../convex/constants"
import {
  decryptCustomPluginServers,
  encryptCustomPluginServerApiKey,
} from "../../services/custom-plugin-server-credentials"

const createCredentialReadToken = (secret: string) =>
  Effect.promise(() =>
    signCredentialReadToken(secret, Date.now() + CREDENTIAL_READ_TOKEN_TTL_MS)
  )

const CUSTOM_PLUGIN_SERVER_USAGE_CONCURRENCY = 3
const CUSTOM_PLUGIN_SERVER_REGISTRATION_LIMIT = 5

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
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          const serviceToken = yield* createCredentialReadToken(
            environment.AUTH_GATEWAY_SECRET
          )
          const storedPluginServers = yield* convex.query(
            api.userPluginServers.listForService,
            { serviceToken },
            { accessToken: user.accessToken }
          )
          const pluginServers = yield* decryptCustomPluginServers(
            environment,
            user.id,
            storedPluginServers
          ).pipe(
            Effect.mapError(
              (error) =>
                new ConvexError({ message: error.message, cause: error })
            )
          )
          return yield* Effect.all(
            pluginServers.flatMap((pluginServer) =>
              pluginServer.enabled
                ? [
                    getCustomPluginServerUsage(pluginServer).pipe(
                      Effect.tap(() =>
                        pluginServer.verificationStatus ===
                        PLUGIN_SERVER_VERIFICATION_STATUS.verified
                          ? Effect.void
                          : convex.mutation(
                              api.userPluginServers.update,
                              {
                                id: pluginServer._id,
                                verificationStatus:
                                  PLUGIN_SERVER_VERIFICATION_STATUS.verified,
                                lastVerifiedAt: Date.now(),
                              },
                              { accessToken: user.accessToken }
                            )
                      ),
                      Effect.catch((error) =>
                        Effect.gen(function* () {
                          if (
                            pluginServer.verificationStatus !==
                            PLUGIN_SERVER_VERIFICATION_STATUS.down
                          ) {
                            yield* convex.mutation(
                              api.userPluginServers.update,
                              {
                                id: pluginServer._id,
                                verificationStatus:
                                  PLUGIN_SERVER_VERIFICATION_STATUS.down,
                              },
                              { accessToken: user.accessToken }
                            )
                          }
                          return {
                            pluginServerId: pluginServer._id,
                            name: pluginServer.baseUrl,
                            metrics: [],
                            error: error.message,
                          }
                        })
                      )
                    ),
                  ]
                : []
            ),
            { concurrency: CUSTOM_PLUGIN_SERVER_USAGE_CONCURRENCY }
          )
        })
      )
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          const requestEvent = yield* RequestEventService
          requestEvent.add({
            operation: "plugin_server_create",
            user_id: user.id,
          })
          const serviceToken = yield* createCredentialReadToken(
            environment.AUTH_GATEWAY_SECRET
          )
          const storedPluginServers = yield* convex.query(
            api.userPluginServers.listForService,
            { serviceToken },
            { accessToken: user.accessToken }
          )
          const existingPluginServers = yield* decryptCustomPluginServers(
            environment,
            user.id,
            storedPluginServers
          ).pipe(
            Effect.mapError(
              (error) =>
                new PluginServerRegistrationError({ message: error.message })
            )
          )
          if (
            existingPluginServers.length >=
            CUSTOM_PLUGIN_SERVER_REGISTRATION_LIMIT
          ) {
            return yield* new PluginServerRegistrationError({
              message: "You have reached the saved plugin server limit.",
            })
          }
          const registration = yield* preparePluginServerRegistration({
            baseUrl: payload.baseUrl,
            apiKey: payload.apiKey,
            existingPluginServers,
            requestId: requestEvent.requestId,
          })

          const pluginServerId = yield* convex.mutation(
            api.userPluginServers.createPending,
            {
              baseUrl: registration.baseUrl,
              manifest: registration.manifestValue,
              enabled: true,
              priority: 0,
              verificationStatus: PLUGIN_SERVER_VERIFICATION_STATUS.verified,
            },
            { accessToken: user.accessToken }
          )
          yield* Effect.gen(function* () {
            const encryptedCredential = yield* encryptCustomPluginServerApiKey(
              environment,
              user.id,
              pluginServerId,
              registration.apiKey
            )
            yield* convex.mutation(
              api.userPluginServers.finalizeEncryptedCredential,
              { id: pluginServerId, ...encryptedCredential },
              { accessToken: user.accessToken }
            )
          }).pipe(
            Effect.catch((error) =>
              convex
                .mutation(
                  api.userPluginServers.deleteById,
                  { id: pluginServerId },
                  { accessToken: user.accessToken }
                )
                .pipe(
                  Effect.andThen(
                    Effect.fail(
                      new PluginServerRegistrationError({
                        message: error.message,
                      })
                    )
                  )
                )
            )
          )

          return { success: true }
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
            api.userPluginServers.update,
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
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          const requestEvent = yield* RequestEventService
          requestEvent.add({
            operation: "plugin_server_refresh",
            user_id: user.id,
            plugin_server_id: params.pluginServerId,
          })
          const serviceToken = yield* createCredentialReadToken(
            environment.AUTH_GATEWAY_SECRET
          )
          const storedPluginServers = yield* convex.query(
            api.userPluginServers.listForService,
            { serviceToken },
            { accessToken: user.accessToken }
          )
          const pluginServers = yield* decryptCustomPluginServers(
            environment,
            user.id,
            storedPluginServers
          ).pipe(
            Effect.mapError(
              (error) =>
                new PluginServerRegistrationError({ message: error.message })
            )
          )
          const pluginServer = pluginServers.find(
            (entry) => entry._id === params.pluginServerId
          )
          if (!pluginServer) {
            return yield* new PluginServerRegistrationError({
              message: "Plugin server not found.",
            })
          }
          const refresh = yield* preparePluginServerRefresh({
            pluginServer,
            requestId: requestEvent.requestId,
          }).pipe(
            Effect.catch((error) =>
              Effect.gen(function* () {
                if (
                  pluginServer.verificationStatus !==
                  PLUGIN_SERVER_VERIFICATION_STATUS.down
                ) {
                  yield* convex.mutation(
                    api.userPluginServers.update,
                    {
                      id: pluginServer._id,
                      verificationStatus:
                        PLUGIN_SERVER_VERIFICATION_STATUS.down,
                    },
                    { accessToken: user.accessToken }
                  )
                }
                return yield* error
              })
            )
          )
          const now = Date.now()
          yield* convex.mutation(
            api.userPluginServers.update,
            {
              id: params.pluginServerId,
              manifest: refresh.manifestValue,
              verificationStatus: PLUGIN_SERVER_VERIFICATION_STATUS.verified,
              lastVerifiedAt: now,
              lastManifestRefreshAt: now,
            },
            { accessToken: user.accessToken }
          )
          return { success: true }
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

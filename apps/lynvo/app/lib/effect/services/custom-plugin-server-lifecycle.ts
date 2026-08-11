import { Effect } from "effect"
import { api } from "../../../../convex/_generated/api"
import { ConvexService } from "./ConvexService"
import { CloudflareEnv } from "./CloudflareEnv"
import {
  preparePluginServerRefresh,
  preparePluginServerRegistration,
  normalizePluginServerBaseUrl,
} from "./plugin-server-registration"
import {
  decryptCustomPluginServers,
  encryptCustomPluginServerApiKey,
} from "./custom-plugin-server-credentials"
import { ConvexError, PluginServerRegistrationError } from "../errors"
import { signCredentialReadToken } from "../../../lib/auth-gateway"
import { CREDENTIAL_READ_TOKEN_TTL_MS } from "../../../../convex/constants"
import { getCustomPluginServerUsage } from "./custom-plugin-server-adapter"

const CUSTOM_PLUGIN_SERVER_USAGE_CONCURRENCY = 3

export interface CustomPluginServerLifecycleUser {
  readonly id: string
  readonly accessToken: string
}

export interface RegisterCustomPluginServerInput {
  readonly baseUrl: string
  readonly apiKey: string
  readonly requestId?: string
  readonly user: CustomPluginServerLifecycleUser
}

export interface RefreshCustomPluginServerInput {
  readonly pluginServerId: string
  readonly requestId?: string
  readonly user: CustomPluginServerLifecycleUser
}

export interface ReadCustomPluginServerUsageInput {
  readonly user: CustomPluginServerLifecycleUser
}

const registrationError = (error: {
  readonly message: string
  readonly cause?: unknown
}) =>
  new PluginServerRegistrationError({
    message:
      error.cause instanceof Error && error.cause.message
        ? error.cause.message
        : error.message,
  })

const createCredentialReadToken = (secret: string) =>
  Effect.promise(() =>
    signCredentialReadToken(secret, Date.now() + CREDENTIAL_READ_TOKEN_TTL_MS)
  )

export const registerCustomPluginServer = Effect.fn(
  "CustomPluginServerLifecycle.register"
)(function* (input: RegisterCustomPluginServerInput) {
  const convex = yield* ConvexService
  const environment = yield* CloudflareEnv
  const normalizedBaseUrl = yield* normalizePluginServerBaseUrl(input.baseUrl)
  const reservation = yield* convex
    .mutation(
      api.userPluginServers.beginRegistration,
      { baseUrl: normalizedBaseUrl },
      { accessToken: input.user.accessToken }
    )
    .pipe(Effect.mapError(registrationError))

  return yield* Effect.gen(function* () {
    const prepared = yield* preparePluginServerRegistration({
      baseUrl: normalizedBaseUrl,
      apiKey: input.apiKey,
      requestId: input.requestId,
    })
    const encryptedCredential = yield* encryptCustomPluginServerApiKey(
      environment,
      input.user.id,
      reservation.id,
      prepared.apiKey
    )
    yield* convex.mutation(
      api.userPluginServers.finalizeEncryptedCredential,
      {
        id: reservation.id,
        generation: reservation.generation,
        attemptId: reservation.attemptId,
        manifest: prepared.manifestValue,
        ...encryptedCredential,
      },
      { accessToken: input.user.accessToken }
    )
    return { success: true }
  }).pipe(
    Effect.mapError(registrationError),
    Effect.catch((primaryError) =>
      convex
        .mutation(
          api.userPluginServers.markRegistrationFailed,
          {
            id: reservation.id,
            reason: primaryError.message,
            generation: reservation.generation,
            attemptId: reservation.attemptId,
          },
          { accessToken: input.user.accessToken }
        )
        .pipe(
          Effect.catch((cleanupError) =>
            Effect.logError("Plugin Server registration recovery failed", {
              pluginServerId: reservation.id,
              error: cleanupError.message,
            })
          ),
          Effect.andThen(Effect.fail(primaryError))
        )
    )
  )
})

export const refreshCustomPluginServer = Effect.fn(
  "CustomPluginServerLifecycle.refresh"
)(function* (input: RefreshCustomPluginServerInput) {
  const convex = yield* ConvexService
  const environment = yield* CloudflareEnv
  const serviceToken = yield* createCredentialReadToken(
    environment.AUTH_GATEWAY_SECRET
  )
  const storedPluginServers = yield* convex.query(
    api.userPluginServers.listForService,
    { serviceToken },
    { accessToken: input.user.accessToken }
  )
  const pluginServers = yield* decryptCustomPluginServers(
    environment,
    input.user.id,
    storedPluginServers
  ).pipe(Effect.mapError(registrationError))
  const pluginServer = pluginServers.find(
    (entry) => entry._id === input.pluginServerId
  )
  if (!pluginServer) {
    return yield* new PluginServerRegistrationError({
      message: "Plugin server not found.",
    })
  }
  const refresh = yield* preparePluginServerRefresh({
    pluginServer,
    requestId: input.requestId,
  }).pipe(
    Effect.catch((primaryError) =>
      convex
        .mutation(
          api.userPluginServers.recordVerificationFailure,
          { id: pluginServer._id },
          { accessToken: input.user.accessToken }
        )
        .pipe(
          Effect.catch((transitionError) =>
            Effect.logError("Plugin Server health transition failed", {
              pluginServerId: pluginServer._id,
              error: transitionError.message,
            })
          ),
          Effect.andThen(Effect.fail(primaryError))
        )
    )
  )
  const now = Date.now()
  yield* convex.mutation(
    api.userPluginServers.recordRefreshSuccess,
    { id: pluginServer._id, manifest: refresh.manifestValue, now },
    { accessToken: input.user.accessToken }
  )
  return { success: true }
})

export const readCustomPluginServerUsage = Effect.fn(
  "CustomPluginServerLifecycle.readUsage"
)(function* (input: ReadCustomPluginServerUsageInput) {
  const convex = yield* ConvexService
  const environment = yield* CloudflareEnv
  const serviceToken = yield* createCredentialReadToken(
    environment.AUTH_GATEWAY_SECRET
  )
  const storedPluginServers = yield* convex.query(
    api.userPluginServers.listForService,
    { serviceToken },
    { accessToken: input.user.accessToken }
  )
  const pluginServers = yield* decryptCustomPluginServers(
    environment,
    input.user.id,
    storedPluginServers
  ).pipe(
    Effect.mapError(
      (error) => new ConvexError({ message: error.message, cause: error })
    )
  )
  return yield* Effect.all(
    pluginServers.flatMap((pluginServer) =>
      pluginServer.enabled
        ? [
            getCustomPluginServerUsage(pluginServer).pipe(
              Effect.tap(() => {
                if (pluginServer.verificationStatus === "verified") {
                  return Effect.void
                }
                const now = Date.now()
                return convex.mutation(
                  api.userPluginServers.recordVerificationSuccess,
                  { id: pluginServer._id, now },
                  { accessToken: input.user.accessToken }
                )
              }),
              Effect.catch((primaryError) =>
                convex
                  .mutation(
                    api.userPluginServers.recordVerificationFailure,
                    { id: pluginServer._id },
                    { accessToken: input.user.accessToken }
                  )
                  .pipe(
                    Effect.catch((transitionError) =>
                      Effect.logError(
                        "Plugin Server health transition failed",
                        {
                          pluginServerId: pluginServer._id,
                          error: transitionError.message,
                        }
                      )
                    ),
                    Effect.as({
                      pluginServerId: pluginServer._id,
                      name: pluginServer.baseUrl,
                      metrics: [],
                      error: primaryError.message,
                    })
                  )
              )
            ),
          ]
        : []
    ),
    { concurrency: CUSTOM_PLUGIN_SERVER_USAGE_CONCURRENCY }
  )
})

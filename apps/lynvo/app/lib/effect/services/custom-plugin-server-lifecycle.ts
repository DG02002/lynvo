import { Effect } from "effect"
import { CloudflareEnv } from "./cloudflare-env"
import {
  ACCOUNT_DATA_UNAVAILABLE_MESSAGE,
  requireDatabaseEffect,
  requireDatabaseEffectAs,
} from "../require-database"
import {
  beginPluginServerRegistration,
  finalizePluginServerCredential,
  listReadyPluginServersForService,
  markPluginServerRegistrationFailed,
  recordPluginServerVerificationFailure,
  recordPluginServerVerificationSuccess,
  recordPluginServerRefreshSuccess,
} from "../../../../workers/d1/plugin-servers"
import {
  preparePluginServerRefresh,
  preparePluginServerRegistration,
  normalizePluginServerBaseUrl,
} from "./plugin-server-registration"
import {
  decryptCustomPluginServers,
  encryptCustomPluginServerApiKey,
} from "./custom-plugin-server-credentials"
import {
  BackendError,
  getErrorMessage,
  PluginServerRegistrationError,
} from "../errors"
import { getCustomPluginServerUsage } from "./custom-plugin-server-adapter"

const CUSTOM_PLUGIN_SERVER_USAGE_CONCURRENCY = 3

export interface CustomPluginServerLifecycleUser {
  readonly id: string
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

const registrationDatabaseError = ({ message }: BackendError) =>
  new PluginServerRegistrationError({ message: `${message}.` })

export const registerCustomPluginServer = Effect.fn(
  "CustomPluginServerLifecycle.register"
)(function* (input: RegisterCustomPluginServerInput) {
  const environment = yield* CloudflareEnv
  const database = yield* requireDatabaseEffectAs(
    environment,
    registrationDatabaseError
  )
  const normalizedBaseUrl = yield* normalizePluginServerBaseUrl(input.baseUrl)
  const reservation = yield* Effect.tryPromise({
    try: () =>
      beginPluginServerRegistration(database, input.user.id, {
        baseUrl: normalizedBaseUrl,
        now: Date.now(),
      }),
    catch: (cause) =>
      registrationError({
        message:
          cause instanceof Error ? cause.message : "Registration rejected",
        cause,
      }),
  })

  return yield* Effect.gen(function* () {
    const prepared = yield* preparePluginServerRegistration({
      baseUrl: normalizedBaseUrl,
      apiKey: input.apiKey,
      requestId: input.requestId,
    })
    const encryptedCredential = yield* encryptCustomPluginServerApiKey({
      environment,
      userId: input.user.id,
      pluginServerId: reservation.id,
      apiKey: prepared.apiKey,
    }).pipe(
      Effect.mapError(
        (error) => new PluginServerRegistrationError({ message: error.message })
      )
    )
    const finalized = yield* Effect.tryPromise({
      try: () =>
        finalizePluginServerCredential(database, input.user.id, {
          id: reservation.id,
          generation: reservation.generation,
          attemptId: reservation.attemptId,
          manifest: prepared.manifestValue,
          ...encryptedCredential,
          now: Date.now(),
        }),
      catch: (cause) =>
        registrationError({
          message:
            cause instanceof Error
              ? cause.message
              : "Registration could not be finalized",
          cause,
        }),
    })
    return { success: true, dataVersion: finalized.dataVersion }
  }).pipe(
    Effect.catch((primaryError) =>
      Effect.tryPromise({
        try: () =>
          markPluginServerRegistrationFailed(database, input.user.id, {
            id: reservation.id,
            reason: primaryError.message,
            generation: reservation.generation,
            attemptId: reservation.attemptId,
            now: Date.now(),
          }),
        catch: (cleanupCause) => cleanupCause,
      }).pipe(
        Effect.catch((cleanupError) =>
          Effect.logError("Plugin Server registration recovery failed", {
            pluginServerId: reservation.id,
            error: getErrorMessage(cleanupError),
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
  const environment = yield* CloudflareEnv
  const database = yield* requireDatabaseEffectAs(
    environment,
    registrationDatabaseError
  )
  const storedPluginServers = yield* Effect.tryPromise({
    try: () => listReadyPluginServersForService(database, input.user.id),
    catch: (cause) =>
      registrationError({
        message:
          cause instanceof Error
            ? cause.message
            : "Plugin servers are unavailable",
        cause,
      }),
  })
  const pluginServers = yield* decryptCustomPluginServers(
    environment,
    input.user.id,
    storedPluginServers
  ).pipe(Effect.mapError(registrationError))
  const pluginServer = pluginServers.find(
    (entry) => entry.id === input.pluginServerId
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
      Effect.tryPromise({
        try: () =>
          recordPluginServerVerificationFailure(database, input.user.id, {
            id: pluginServer.id,
            now: Date.now(),
          }),
        catch: (transitionCause) => transitionCause,
      }).pipe(
        Effect.catch((transitionError) =>
          Effect.logError("Plugin Server health transition failed", {
            pluginServerId: pluginServer.id,
            error: getErrorMessage(transitionError),
          })
        ),
        Effect.andThen(Effect.fail(primaryError))
      )
    )
  )
  const now = Date.now()
  const recorded = yield* Effect.tryPromise({
    try: () =>
      recordPluginServerRefreshSuccess(database, input.user.id, {
        id: pluginServer.id,
        manifest: refresh.manifestValue,
        now,
      }),
    catch: (cause) =>
      registrationError({
        message:
          cause instanceof Error ? cause.message : "Refresh could not be saved",
        cause,
      }),
  })
  return { success: true, dataVersion: recorded.dataVersion }
})

export const readCustomPluginServerUsage = Effect.fn(
  "CustomPluginServerLifecycle.readUsage"
)(function* (input: ReadCustomPluginServerUsageInput) {
  const environment = yield* CloudflareEnv
  const database = yield* requireDatabaseEffect(
    environment,
    ACCOUNT_DATA_UNAVAILABLE_MESSAGE
  )
  const storedPluginServers = yield* Effect.tryPromise({
    try: () => listReadyPluginServersForService(database, input.user.id),
    catch: (cause) =>
      new BackendError({
        message: "Plugin servers are temporarily unavailable",
        cause,
      }),
  })
  const pluginServers = yield* decryptCustomPluginServers(
    environment,
    input.user.id,
    storedPluginServers
  ).pipe(
    Effect.mapError(
      (error) => new BackendError({ message: error.message, cause: error })
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
                return Effect.tryPromise({
                  try: () =>
                    recordPluginServerVerificationSuccess(
                      database,
                      input.user.id,
                      {
                        id: pluginServer.id,
                        now,
                      }
                    ),
                  catch: (cause) =>
                    new BackendError({
                      message: "Plugin server health transition failed",
                      cause,
                    }),
                })
              }),
              Effect.catch((primaryError) =>
                Effect.tryPromise({
                  try: () =>
                    recordPluginServerVerificationFailure(
                      database,
                      input.user.id,
                      {
                        id: pluginServer.id,
                        now: Date.now(),
                      }
                    ),
                  catch: (transitionCause) => transitionCause,
                }).pipe(
                  Effect.catch((transitionError) =>
                    Effect.logError("Plugin Server health transition failed", {
                      pluginServerId: pluginServer.id,
                      error: getErrorMessage(transitionError),
                    })
                  ),
                  Effect.as({
                    pluginServerId: pluginServer.id,
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

import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../Api"
import { CurrentUser } from "../Middleware"
import { ConvexService } from "../../services/ConvexService"
import {
  prepareWorkerRefresh,
  prepareWorkerRegistration,
} from "../../services/WorkerRegistration"
import { api } from "../../../../../convex/_generated/api"
import { ConvexError, WorkerRegistrationError } from "../../errors"
import { RequestEventService } from "../../services/request-event-service"
import { getWorkerUsage } from "../../services/WorkerExtractorAdapter"
import { WORKER_VERIFICATION_STATUS } from "../../services/worker-verification-status"
import { CloudflareEnv } from "../../services/CloudflareEnv"
import { signCredentialReadToken } from "../../../../lib/auth-gateway"
import { CREDENTIAL_READ_TOKEN_TTL_MS } from "../../../../../convex/constants"
import {
  decryptExternalWorkers,
  encryptExternalWorkerApiKey,
} from "../../services/external-worker-credentials"

const createCredentialReadToken = (secret: string) =>
  Effect.promise(() =>
    signCredentialReadToken(secret, Date.now() + CREDENTIAL_READ_TOKEN_TTL_MS)
  )

const EXTERNAL_WORKER_USAGE_CONCURRENCY = 3
const EXTERNAL_WORKER_REGISTRATION_LIMIT = 5

export const WorkersHandlers = HttpApiBuilder.group(
  Api,
  "workers",
  (handlers) =>
    handlers
      .handle("list", () =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          const requestEvent = yield* RequestEventService
          requestEvent.add({
            operation: "extractor_worker_list",
            user_id: user.id,
          })
          return yield* convex.query(
            api.userWorkers.list,
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
          const storedWorkers = yield* convex.query(
            api.userWorkers.listForService,
            { serviceToken },
            { accessToken: user.accessToken }
          )
          const workers = yield* decryptExternalWorkers(
            environment,
            user.id,
            storedWorkers
          ).pipe(
            Effect.mapError(
              (error) =>
                new ConvexError({ message: error.message, cause: error })
            )
          )
          return yield* Effect.all(
            workers.flatMap((worker) =>
              worker.enabled
                ? [
                    getWorkerUsage(worker).pipe(
                      Effect.tap(() =>
                        worker.verificationStatus ===
                        WORKER_VERIFICATION_STATUS.verified
                          ? Effect.void
                          : convex.mutation(
                              api.userWorkers.update,
                              {
                                id: worker._id,
                                verificationStatus:
                                  WORKER_VERIFICATION_STATUS.verified,
                                lastVerifiedAt: Date.now(),
                              },
                              { accessToken: user.accessToken }
                            )
                      ),
                      Effect.catch((error) =>
                        Effect.gen(function* () {
                          if (
                            worker.verificationStatus !==
                            WORKER_VERIFICATION_STATUS.down
                          ) {
                            yield* convex.mutation(
                              api.userWorkers.update,
                              {
                                id: worker._id,
                                verificationStatus:
                                  WORKER_VERIFICATION_STATUS.down,
                              },
                              { accessToken: user.accessToken }
                            )
                          }
                          return {
                            workerId: worker._id,
                            name: worker.baseUrl,
                            metrics: [],
                            error: error.message,
                          }
                        })
                      )
                    ),
                  ]
                : []
            ),
            { concurrency: EXTERNAL_WORKER_USAGE_CONCURRENCY }
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
            operation: "extractor_worker_create",
            user_id: user.id,
          })
          const serviceToken = yield* createCredentialReadToken(
            environment.AUTH_GATEWAY_SECRET
          )
          const storedWorkers = yield* convex.query(
            api.userWorkers.listForService,
            { serviceToken },
            { accessToken: user.accessToken }
          )
          const existingWorkers = yield* decryptExternalWorkers(
            environment,
            user.id,
            storedWorkers
          ).pipe(
            Effect.mapError(
              (error) => new WorkerRegistrationError({ message: error.message })
            )
          )
          if (existingWorkers.length >= EXTERNAL_WORKER_REGISTRATION_LIMIT) {
            return yield* new WorkerRegistrationError({
              message: "You have reached the saved extractor limit.",
            })
          }
          const registration = yield* prepareWorkerRegistration({
            baseUrl: payload.baseUrl,
            apiKey: payload.apiKey,
            existingWorkers,
            requestId: requestEvent.requestId,
          })

          const workerId = yield* convex.mutation(
            api.userWorkers.createPending,
            {
              baseUrl: registration.baseUrl,
              manifest: registration.manifestValue,
              enabled: true,
              priority: 0,
              verificationStatus: WORKER_VERIFICATION_STATUS.verified,
            },
            { accessToken: user.accessToken }
          )
          yield* Effect.gen(function* () {
            const encryptedCredential = yield* encryptExternalWorkerApiKey(
              environment,
              user.id,
              workerId,
              registration.apiKey
            )
            yield* convex.mutation(
              api.userWorkers.finalizeEncryptedCredential,
              { id: workerId, ...encryptedCredential },
              { accessToken: user.accessToken }
            )
          }).pipe(
            Effect.catch((error) =>
              convex
                .mutation(
                  api.userWorkers.deleteById,
                  { id: workerId },
                  { accessToken: user.accessToken }
                )
                .pipe(
                  Effect.andThen(
                    Effect.fail(
                      new WorkerRegistrationError({ message: error.message })
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
            operation: "extractor_worker_toggle",
            user_id: user.id,
            worker_id: params.workerId,
            worker_enabled: payload.enabled,
          })
          yield* convex.mutation(
            api.userWorkers.update,
            {
              id: params.workerId,
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
            operation: "extractor_worker_refresh",
            user_id: user.id,
            worker_id: params.workerId,
          })
          const serviceToken = yield* createCredentialReadToken(
            environment.AUTH_GATEWAY_SECRET
          )
          const storedWorkers = yield* convex.query(
            api.userWorkers.listForService,
            { serviceToken },
            { accessToken: user.accessToken }
          )
          const workers = yield* decryptExternalWorkers(
            environment,
            user.id,
            storedWorkers
          ).pipe(
            Effect.mapError(
              (error) => new WorkerRegistrationError({ message: error.message })
            )
          )
          const worker = workers.find((entry) => entry._id === params.workerId)
          if (!worker) {
            return yield* new WorkerRegistrationError({
              message: "Extractor worker not found.",
            })
          }
          const refresh = yield* prepareWorkerRefresh({
            worker,
            requestId: requestEvent.requestId,
          }).pipe(
            Effect.catch((error) =>
              Effect.gen(function* () {
                if (
                  worker.verificationStatus !== WORKER_VERIFICATION_STATUS.down
                ) {
                  yield* convex.mutation(
                    api.userWorkers.update,
                    {
                      id: worker._id,
                      verificationStatus: WORKER_VERIFICATION_STATUS.down,
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
            api.userWorkers.update,
            {
              id: params.workerId,
              manifest: refresh.manifestValue,
              verificationStatus: WORKER_VERIFICATION_STATUS.verified,
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
            operation: "extractor_worker_delete",
            user_id: user.id,
            worker_id: params.workerId,
          })
          yield* convex.mutation(
            api.userWorkers.deleteById,
            {
              id: params.workerId,
            },
            { accessToken: user.accessToken }
          )
          return { success: true }
        })
      )
)

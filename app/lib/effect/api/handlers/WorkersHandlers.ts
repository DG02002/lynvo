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
import { WorkerRegistrationError } from "../../errors"
import { RequestEventService } from "../../services/request-event-service"
import { getWorkerUsage } from "../../services/WorkerExtractorAdapter"
import { WORKER_VERIFICATION_STATUS } from "../../services/worker-verification-status"

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
          const workers = yield* convex.query(
            api.userWorkers.list,
            {},
            { accessToken: user.accessToken }
          )
          return yield* Effect.all(
            workers
              .filter((worker) => worker.enabled)
              .map((worker) =>
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
                            verificationStatus: WORKER_VERIFICATION_STATUS.down,
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
                )
              ),
            { concurrency: "unbounded" }
          )
        })
      )
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          const requestEvent = yield* RequestEventService
          requestEvent.add({
            operation: "extractor_worker_create",
            user_id: user.id,
          })
          const existingWorkers = yield* convex.query(
            api.userWorkers.list,
            {},
            { accessToken: user.accessToken }
          )
          const registration = yield* prepareWorkerRegistration({
            baseUrl: payload.baseUrl,
            apiKey: payload.apiKey,
            existingWorkers,
            requestId: requestEvent.requestId,
          })

          yield* convex.mutation(
            api.userWorkers.create,
            {
              baseUrl: registration.baseUrl,
              apiKey: registration.apiKey,
              manifest: registration.manifestValue,
              enabled: true,
              priority: 0,
              verificationStatus: WORKER_VERIFICATION_STATUS.verified,
            },
            { accessToken: user.accessToken }
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
          const requestEvent = yield* RequestEventService
          requestEvent.add({
            operation: "extractor_worker_refresh",
            user_id: user.id,
            worker_id: params.workerId,
          })
          const workers = yield* convex.query(
            api.userWorkers.list,
            {},
            { accessToken: user.accessToken }
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

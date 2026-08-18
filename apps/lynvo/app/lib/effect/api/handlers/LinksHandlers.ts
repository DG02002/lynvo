import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../Api"
import { CurrentUser } from "../Middleware"
import { ConvexService } from "../../services/ConvexService"
import { api } from "../../../../../convex/_generated/api"
import { getDailyTimeBucket } from "../../../use-coarse-time-bucket"
import { linkMetadataSchema } from "~/features/links/storage-schemas"
import { extractedLinkSchema } from "~/features/links/storage-schemas"
import { ValidationError } from "../../errors"
import { CloudflareEnv } from "../../services/CloudflareEnv"
import { createSavedLinkRealtimeDelivery } from "../../../../../workers/saved-link-realtime-delivery"
import { RequestEventService } from "../../services/request-event-service"
import { toSavedLinkCommandError } from "~/features/links/saved-link-command-adapter"

const encodeCanonicalMetadata = <Value>(metadata: Value) =>
  Effect.try({
    try: () => JSON.stringify(linkMetadataSchema.parse(metadata)),
    catch: (details) =>
      new ValidationError({
        message: "Saved link metadata is invalid",
        details,
      }),
  })

export const LinksHandlers = HttpApiBuilder.group(Api, "links", (handlers) =>
  handlers
    .handle("list", () =>
      Effect.gen(function* () {
        const convex = yield* ConvexService
        const user = yield* CurrentUser
        return yield* convex.query(
          api.links.list,
          { timeBucket: getDailyTimeBucket(Date.now()) },
          {
            accessToken: user.accessToken,
          }
        )
      })
    )
    .handle("revision", () =>
      Effect.gen(function* () {
        const convex = yield* ConvexService
        const user = yield* CurrentUser
        return yield* convex.query(
          api.links.revision,
          {},
          {
            accessToken: user.accessToken,
          }
        )
      })
    )
    .handle("create", ({ payload }) =>
      Effect.gen(function* () {
        const convex = yield* ConvexService
        const user = yield* CurrentUser
        const requestEvent = yield* RequestEventService
        requestEvent.add({ operation_id: payload.operationId })
        const metadataJson = yield* encodeCanonicalMetadata(payload.meta)
        const result = yield* convex
          .mutation(
            api.links.createOrUpdate,
            {
              operationId: payload.operationId,
              url: payload.url,
              title: payload.title,
              meta: metadataJson,
            },
            { accessToken: user.accessToken }
          )
          .pipe(
            Effect.mapError((error) =>
              toSavedLinkCommandError(error.cause, requestEvent.requestId)
            )
          )
        const environment = yield* CloudflareEnv
        const delivery = yield* Effect.promise(() =>
          createSavedLinkRealtimeDelivery(environment).deliver(
            user.id,
            result.revision
          )
        )
        requestEvent.add({
          saved_link_synchronization: {
            client_revision: payload.clientRevision,
            server_revision: result.revision,
            delivery_mode: "immediate",
            delivery_outcome: delivery.kind,
            reconciliation_outcome:
              delivery.kind === "completed" ? "not_required" : "pending",
          },
        })
        return {
          id: result.id,
          synchronization: { revision: result.revision },
        }
      })
    )
    .handle("delete", ({ params }) =>
      Effect.gen(function* () {
        const convex = yield* ConvexService
        const user = yield* CurrentUser
        const requestEvent = yield* RequestEventService
        const result = yield* convex
          .mutation(
            api.links.deleteById,
            {
              id: params.linkId,
            },
            { accessToken: user.accessToken }
          )
          .pipe(
            Effect.mapError((error) =>
              toSavedLinkCommandError(error.cause, requestEvent.requestId)
            )
          )
        const environment = yield* CloudflareEnv
        const delivery = yield* Effect.promise(() =>
          createSavedLinkRealtimeDelivery(environment).deliver(
            user.id,
            result.revision
          )
        )
        requestEvent.add({
          saved_link_synchronization: {
            server_revision: result.revision,
            delivery_mode: "immediate",
            delivery_outcome: delivery.kind,
            reconciliation_outcome:
              delivery.kind === "completed" ? "not_required" : "pending",
          },
        })
        return {
          success: true,
          synchronization: { revision: result.revision },
        }
      })
    )
    .handle("updateMeta", ({ params, payload }) =>
      Effect.gen(function* () {
        const convex = yield* ConvexService
        const user = yield* CurrentUser
        const requestEvent = yield* RequestEventService
        requestEvent.add({ operation_id: payload.operationId })
        const metadataJson = yield* encodeCanonicalMetadata(payload.meta)
        const result = yield* convex
          .mutation(
            api.links.updateMeta,
            {
              operationId: payload.operationId,
              id: params.linkId,
              meta: metadataJson,
            },
            { accessToken: user.accessToken }
          )
          .pipe(
            Effect.mapError((error) =>
              toSavedLinkCommandError(error.cause, requestEvent.requestId)
            )
          )
        const environment = yield* CloudflareEnv
        const delivery = yield* Effect.promise(() =>
          createSavedLinkRealtimeDelivery(environment).deliver(
            user.id,
            result.revision
          )
        )
        requestEvent.add({
          saved_link_synchronization: {
            client_revision: payload.clientRevision,
            server_revision: result.revision,
            delivery_mode: "immediate",
            delivery_outcome: delivery.kind,
            reconciliation_outcome:
              delivery.kind === "completed" ? "not_required" : "pending",
          },
        })
        return {
          success: true,
          synchronization: { revision: result.revision },
        }
      })
    )
    .handle("applyMetadataOperation", ({ params, payload }) =>
      Effect.gen(function* () {
        const convex = yield* ConvexService
        const user = yield* CurrentUser
        const requestEvent = yield* RequestEventService
        requestEvent.add({ operation_id: payload.operationId })
        const operation = yield* Effect.try({
          try: () => {
            switch (payload.operation.kind) {
              case "markOpened":
              case "removeExtractedLink":
                return payload.operation
              case "cacheMirrors":
                return {
                  kind: payload.operation.kind,
                  lazyItemUrl: payload.operation.lazyItemUrl,
                  mirrorsJson: JSON.stringify(
                    extractedLinkSchema.array().parse(payload.operation.mirrors)
                  ),
                }
              case "replaceExtraction":
                return {
                  kind: payload.operation.kind,
                  expectedExtractionJson: JSON.stringify(
                    extractedLinkSchema
                      .array()
                      .parse(payload.operation.expectedExtraction)
                  ),
                  extractedLinksJson: JSON.stringify(
                    extractedLinkSchema
                      .array()
                      .parse(payload.operation.extractedLinks)
                  ),
                }
            }
          },
          catch: (details) =>
            new ValidationError({
              message: "Saved link metadata operation is invalid",
              details,
            }),
        })
        const result = yield* convex
          .mutation(
            api.links.applyMetadataOperation,
            { operationId: payload.operationId, id: params.linkId, operation },
            { accessToken: user.accessToken }
          )
          .pipe(
            Effect.mapError((error) =>
              toSavedLinkCommandError(error.cause, requestEvent.requestId)
            )
          )
        const environment = yield* CloudflareEnv
        const delivery = yield* Effect.promise(() =>
          createSavedLinkRealtimeDelivery(environment).deliver(
            user.id,
            result.revision
          )
        )
        requestEvent.add({
          saved_link_synchronization: {
            client_revision: payload.clientRevision,
            server_revision: result.revision,
            delivery_mode: "immediate",
            delivery_outcome: delivery.kind,
            reconciliation_outcome:
              delivery.kind === "completed" ? "not_required" : "pending",
          },
        })
        return {
          success: true,
          synchronization: { revision: result.revision },
        }
      })
    )
)

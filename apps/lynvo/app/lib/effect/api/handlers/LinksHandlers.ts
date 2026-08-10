import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../Api"
import { CurrentUser } from "../Middleware"
import { ConvexService } from "../../services/ConvexService"
import { api } from "../../../../../convex/_generated/api"
import { getDailyTimeBucket } from "../../../use-coarse-time-bucket"
import { linkMetadataSchema } from "~/features/links/storage-schemas"
import { ValidationError } from "../../errors"
import { CloudflareEnv } from "../../services/CloudflareEnv"
import { createSavedLinkRealtimeDelivery } from "../../../../../workers/saved-link-realtime-delivery"

const encodeCanonicalMetadata = (metadata: unknown) =>
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
        const metadataJson = yield* encodeCanonicalMetadata(payload.meta)
        const result = yield* convex.mutation(
          api.links.createOrUpdate,
          {
            url: payload.url,
            title: payload.title,
            meta: metadataJson,
          },
          { accessToken: user.accessToken }
        )
        const environment = yield* CloudflareEnv
        yield* Effect.promise(() =>
          createSavedLinkRealtimeDelivery(environment).deliver(
            user.id,
            result.revision
          )
        )
        return result.id
      })
    )
    .handle("delete", ({ params }) =>
      Effect.gen(function* () {
        const convex = yield* ConvexService
        const user = yield* CurrentUser
        const result = yield* convex.mutation(
          api.links.deleteById,
          {
            id: params.linkId,
          },
          { accessToken: user.accessToken }
        )
        const environment = yield* CloudflareEnv
        yield* Effect.promise(() =>
          createSavedLinkRealtimeDelivery(environment).deliver(
            user.id,
            result.revision
          )
        )
        return { success: true }
      })
    )
    .handle("updateMeta", ({ params, payload }) =>
      Effect.gen(function* () {
        const convex = yield* ConvexService
        const user = yield* CurrentUser
        const metadataJson = yield* encodeCanonicalMetadata(payload.meta)
        const result = yield* convex.mutation(
          api.links.updateMeta,
          {
            id: params.linkId,
            meta: metadataJson,
          },
          { accessToken: user.accessToken }
        )
        const environment = yield* CloudflareEnv
        yield* Effect.promise(() =>
          createSavedLinkRealtimeDelivery(environment).deliver(
            user.id,
            result.revision
          )
        )
        return { success: true }
      })
    )
)

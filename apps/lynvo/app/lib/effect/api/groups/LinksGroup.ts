import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { WebAuth, CsrfMiddleware } from "../Middleware"
import {
  UnauthorizedApiError,
  CsrfApiError,
  ConvexApiError,
} from "../../errors"

const LinkSchema = Schema.Struct({
  _id: Schema.String,
  url: Schema.String,
  title: Schema.optional(Schema.String),
  meta: Schema.optional(Schema.String),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})

export class LinksGroup extends HttpApiGroup.make("links")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: Schema.Array(LinkSchema),
      error: [UnauthorizedApiError, ConvexApiError],
    }),
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({
        url: Schema.String,
        title: Schema.optional(Schema.String),
        meta: Schema.optional(Schema.Unknown),
      }),
      success: Schema.String,
      error: [UnauthorizedApiError, CsrfApiError, ConvexApiError],
    }),
    HttpApiEndpoint.delete("delete", "/:linkId", {
      params: {
        linkId: Schema.String,
      },
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedApiError, CsrfApiError, ConvexApiError],
    }),
    HttpApiEndpoint.post("updateMeta", "/:linkId/meta", {
      params: {
        linkId: Schema.String,
      },
      payload: Schema.Struct({
        meta: Schema.Unknown,
      }),
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedApiError, CsrfApiError, ConvexApiError],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/links") {}

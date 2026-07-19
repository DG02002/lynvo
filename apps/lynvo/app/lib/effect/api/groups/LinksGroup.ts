import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { WebAuth, CsrfMiddleware } from "../Middleware"
import { UnauthorizedError, CsrfError, ConvexError } from "../../errors"

export class LinksGroup extends HttpApiGroup.make("links")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: Schema.Array(Schema.Unknown),
      error: [UnauthorizedError, ConvexError],
    }),
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({
        url: Schema.String,
        title: Schema.optional(Schema.String),
        meta: Schema.optional(Schema.Unknown),
      }),
      success: Schema.Unknown,
      error: [UnauthorizedError, CsrfError, ConvexError],
    }),
    HttpApiEndpoint.delete("delete", "/:linkId", {
      params: {
        linkId: Schema.String,
      },
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedError, CsrfError, ConvexError],
    }),
    HttpApiEndpoint.post("updateMeta", "/:linkId/meta", {
      params: {
        linkId: Schema.String,
      },
      payload: Schema.Struct({
        meta: Schema.Unknown,
      }),
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedError, CsrfError, ConvexError],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/links") {}

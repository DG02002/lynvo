import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { WebAuth, CsrfMiddleware } from "../Middleware"
import {
  UnauthorizedApiError,
  CsrfApiError,
  ConvexApiError,
} from "../../errors"

export class TvGroup extends HttpApiGroup.make("tv")
  .add(
    HttpApiEndpoint.get("status", "/tv/status", {
      query: Schema.Struct({
        code: Schema.String,
        pollSecret: Schema.String,
      }),
      success: Schema.Struct({
        status: Schema.String,
        deviceName: Schema.optional(Schema.String),
        expiresAt: Schema.optional(Schema.Number),
      }),
      error: ConvexApiError,
    }),
    HttpApiEndpoint.get("approval", "/tv/approval", {
      query: Schema.Struct({ code: Schema.String }),
      success: Schema.NullOr(
        Schema.Struct({
          code: Schema.String,
          status: Schema.String,
          deviceName: Schema.String,
          expiresAt: Schema.Number,
        })
      ),
      error: [UnauthorizedApiError, ConvexApiError],
    }).middleware(WebAuth),
    HttpApiEndpoint.post("authorize", "/tv/authorize", {
      payload: Schema.Struct({
        code: Schema.String,
      }),
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedApiError, CsrfApiError, ConvexApiError],
    })
      .middleware(WebAuth)
      .middleware(CsrfMiddleware),
    HttpApiEndpoint.get("exchange", "/tv/exchange", {
      query: Schema.Struct({
        code: Schema.String,
      }),
      success: Schema.Struct({ success: Schema.Boolean }),
      error: ConvexApiError,
    })
  )
  .prefix("/api/auth") {}

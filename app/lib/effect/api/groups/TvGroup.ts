import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { WebAuth, CsrfMiddleware } from "../Middleware"
import { UnauthorizedError, CsrfError, ConvexError } from "../../errors"

export class TvGroup extends HttpApiGroup.make("tv")
  .add(
    HttpApiEndpoint.post("code", "/tv/code", {
      payload: Schema.Struct({
        deviceName: Schema.String,
      }),
      success: Schema.Unknown,
      error: ConvexError,
    }),
    HttpApiEndpoint.get("poll", "/tv/poll", {
      query: Schema.Struct({
        code: Schema.String,
      }),
      success: Schema.Unknown,
      error: ConvexError,
    }),
    HttpApiEndpoint.post("authorize", "/tv/authorize", {
      payload: Schema.Struct({
        code: Schema.String,
      }),
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedError, CsrfError, ConvexError],
    })
      .middleware(WebAuth)
      .middleware(CsrfMiddleware),
    HttpApiEndpoint.get("exchange", "/tv/exchange", {
      query: Schema.Struct({
        code: Schema.String,
      }),
      success: Schema.Struct({ success: Schema.Boolean }),
      error: ConvexError,
    })
  )
  .prefix("/api/auth") {}

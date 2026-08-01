import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { WebAuth, CsrfMiddleware } from "../Middleware"
import {
  UnauthorizedApiError,
  CsrfApiError,
  ConvexApiError,
} from "../../errors"

export class RemoteGroup extends HttpApiGroup.make("remote")
  .add(
    HttpApiEndpoint.post("send", "/send", {
      payload: Schema.Struct({
        target_session_id: Schema.String,
        command: Schema.Literals(["play", "pause"]),
        data: Schema.optional(Schema.Unknown),
      }),
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedApiError, CsrfApiError, ConvexApiError],
    }),
    HttpApiEndpoint.get("pollInbox", "/inbox", {
      success: Schema.Struct({
        commands: Schema.Array(
          Schema.Struct({
            id: Schema.String,
            command: Schema.Literals(["play", "pause"]),
            payload: Schema.String,
            createdAt: Schema.Number,
          })
        ),
      }),
      error: [UnauthorizedApiError, ConvexApiError],
    }),
    HttpApiEndpoint.post("acknowledge", "/acknowledge", {
      payload: Schema.Struct({ id: Schema.String }),
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedApiError, CsrfApiError, ConvexApiError],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/remote") {}

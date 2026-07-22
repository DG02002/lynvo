import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { WebAuth, CsrfMiddleware } from "../Middleware"
import { UnauthorizedError, CsrfError, ConvexError } from "../../errors"

export class RemoteGroup extends HttpApiGroup.make("remote")
  .add(
    HttpApiEndpoint.post("send", "/send", {
      payload: Schema.Struct({
        target_session_id: Schema.String,
        command: Schema.Literals(["play", "pause"]),
        data: Schema.optional(Schema.Unknown),
      }),
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedError, CsrfError, ConvexError],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/remote") {}

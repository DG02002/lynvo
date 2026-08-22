import { Context, Schema } from "effect"
import { HttpApiMiddleware } from "effect/unstable/httpapi"
import { UnauthorizedError, CsrfError, BackendError } from "../errors"

export class CurrentUser extends Context.Service<
  CurrentUser,
  {
    readonly id: string
    readonly email: string
    readonly sid: string
  }
>()("app/effect/api/CurrentUser") {}

export class WebAuth extends HttpApiMiddleware.Service<
  WebAuth,
  {
    provides: CurrentUser
  }
>()("app/effect/api/WebAuth", {
  error: Schema.Union([UnauthorizedError, BackendError]),
}) {}

export class CsrfMiddleware extends HttpApiMiddleware.Service<CsrfMiddleware>()(
  "app/effect/api/CsrfMiddleware",
  {
    error: CsrfError,
  }
) {}

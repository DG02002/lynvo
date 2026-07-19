import { Context } from "effect"
import { HttpApiMiddleware } from "effect/unstable/httpapi"
import { UnauthorizedError, CsrfError } from "../errors"

export class CurrentUser extends Context.Service<
  CurrentUser,
  {
    readonly id: string
    readonly username: string
    readonly sid: string
    readonly accessToken: string
  }
>()("app/effect/api/CurrentUser") {}

export class WebAuth extends HttpApiMiddleware.Service<
  WebAuth,
  {
    provides: CurrentUser
  }
>()("app/effect/api/WebAuth", {
  error: UnauthorizedError,
}) {}

export class CsrfMiddleware extends HttpApiMiddleware.Service<CsrfMiddleware>()(
  "app/effect/api/CsrfMiddleware",
  {
    error: CsrfError,
  }
) {}

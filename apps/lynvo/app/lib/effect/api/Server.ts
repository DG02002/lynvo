import { Effect, Layer, Option } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { HttpRouter, HttpServerRequest } from "effect/unstable/http"
import { Api } from "./Api"
import { LinksHandlers } from "./handlers/LinksHandlers"
import { WorkersHandlers } from "./handlers/WorkersHandlers"
import { PluginDomainsHandlers } from "./handlers/PluginDomainsHandlers"
import { ExtractorHandlers } from "./handlers/ExtractorHandlers"
import { TvHandlers } from "./handlers/TvHandlers"
import { RemoteHandlers } from "./handlers/RemoteHandlers"
import { WebAuth, CsrfMiddleware, CurrentUser } from "./Middleware"
import { validateCSRF } from "../../csrf"
import { AuthSessionService } from "../services/AuthSessionService"
import { UnauthorizedError, CsrfError } from "../errors"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Etag from "effect/unstable/http/Etag"
import * as HttpPlatform from "effect/unstable/http/HttpPlatform"

const webRequestFromSource = (source: object) =>
  source instanceof Request
    ? Effect.succeed(source)
    : Effect.die(new Error("HTTP server request source is not a Web Request"))

// Implement WebAuth middleware
export const WebAuthLive = Layer.succeed(
  WebAuth,
  WebAuth.of((httpEffect) =>
    Effect.gen(function* () {
      const authSessionOption = yield* Effect.serviceOption(AuthSessionService)
      const authSession = Option.getOrThrow(authSessionOption)
      const request = yield* HttpServerRequest.HttpServerRequest
      const webRequest = yield* webRequestFromSource(request.source)
      const result = yield* authSession.getSession(webRequest)

      if (!result.user || !result.accessToken) {
        return yield* new UnauthorizedError({ message: "Unauthorized" })
      }

      const response = yield* Effect.provideService(httpEffect, CurrentUser, {
        ...result.user,
        accessToken: result.accessToken,
      })

      return response
    })
  )
)

// Implement CsrfMiddleware
export const CsrfLive = Layer.succeed(
  CsrfMiddleware,
  CsrfMiddleware.of((httpEffect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      const method = request.method

      if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        const url = request.url.startsWith("http")
          ? request.url
          : `https://localhost${request.url}`
        const webRequest = new Request(url, {
          method: request.method,
          headers: request.headers,
        })

        const isValid = yield* Effect.tryPromise({
          try: () => validateCSRF(webRequest),
          catch: (cause) =>
            new CsrfError({ message: "CSRF validation failed", cause }),
        })
        if (!isValid) {
          return yield* new CsrfError({ message: "Invalid CSRF token" })
        }
      }

      return yield* httpEffect
    })
  )
)

// Combine all handlers and middlewares into a router layer
const MiddlewaresLive = Layer.mergeAll(WebAuthLive, CsrfLive)

const HandlersLive = Layer.mergeAll(
  LinksHandlers,
  WorkersHandlers,
  PluginDomainsHandlers,
  ExtractorHandlers,
  TvHandlers,
  RemoteHandlers
)

const ApiRoutes = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(HandlersLive),
  Layer.provide(MiddlewaresLive)
)

const PlatformLive = Layer.mergeAll(
  Path.layer,
  Etag.layer,
  HttpPlatform.layer
).pipe(Layer.provideMerge(FileSystem.layerNoop({})))

const RouterLive = ApiRoutes.pipe(
  Layer.provideMerge(HttpRouter.layer),
  Layer.provide(PlatformLive)
)

export const { handler } = HttpRouter.toWebHandler(RouterLive)

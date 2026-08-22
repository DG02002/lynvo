import { Effect, Layer, Option } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { HttpRouter, HttpServerRequest } from "effect/unstable/http"
import { Api } from "./api"
import { PluginServersHandlers } from "./handlers/plugin-servers-handlers"
import { PluginDomainsHandlers } from "./handlers/plugin-domains-handlers"
import { ExtractionHandlers } from "./handlers/extraction-handlers"
import { RemoteHandlers } from "./handlers/remote-handlers"
import { SettingsHandlers } from "./handlers/settings-handlers"
import { WebAuth, CsrfMiddleware, CurrentUser } from "./middleware"
import { validateCSRF } from "../../csrf"
import { CloudflareEnv } from "../services/cloudflare-env"
import { UnauthorizedError, CsrfError, BackendError } from "../errors"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Etag from "effect/unstable/http/Etag"
import * as HttpPlatform from "effect/unstable/http/HttpPlatform"
import { getD1Database } from "../../../../workers/d1/db"
import { resolveSessionContext } from "../../../../workers/d1/sessions"

const webRequestFromSource = <Source>(source: Source) =>
  source instanceof Request
    ? Effect.succeed(source)
    : Effect.die(new Error("HTTP server request source is not a Web Request"))

// Implement WebAuth middleware
export const WebAuthLive = Layer.succeed(
  WebAuth,
  WebAuth.of((httpEffect) =>
    Effect.gen(function* () {
      const environmentOption = yield* Effect.serviceOption(CloudflareEnv)
      const environment = Option.getOrThrow(environmentOption)
      const request = yield* HttpServerRequest.HttpServerRequest
      const webRequest = yield* webRequestFromSource(request.source)
      const database = getD1Database(environment)
      if (!database) {
        return yield* new BackendError({
          message: "Authentication is temporarily unavailable",
        })
      }
      const session = yield* Effect.promise(() =>
        resolveSessionContext(webRequest, database, Date.now())
      )

      if (!session) {
        return yield* new UnauthorizedError({ message: "Unauthorized" })
      }
      const expectedUserId = request.headers["x-lynvo-expected-user-id"]
      const expectedSessionId = request.headers["x-lynvo-expected-session-id"]
      if (
        expectedUserId !== session.userId ||
        expectedSessionId !== session.sessionId
      ) {
        return yield* new UnauthorizedError({
          message: "Session identity changed",
        })
      }

      const response = yield* Effect.provideService(httpEffect, CurrentUser, {
        id: session.userId,
        email: session.email,
        sid: session.sessionId,
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
  PluginServersHandlers,
  PluginDomainsHandlers,
  ExtractionHandlers,
  RemoteHandlers,
  SettingsHandlers
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

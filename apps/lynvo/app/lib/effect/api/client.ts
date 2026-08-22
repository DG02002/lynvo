import { Context, Effect, Layer } from "effect"
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "effect/unstable/http"
import { HttpApiClient } from "effect/unstable/httpapi"
import { Api } from "./api"
import { getCsrfToken } from "../../utils"
import { sessionIdentityHeaders } from "../../session-identity"

export class ApiClient extends Context.Service<
  ApiClient,
  HttpApiClient.ForApi<typeof Api>
>()("app/effect/api/ApiClient") {
  static readonly layer = Layer.effect(
    ApiClient,
    HttpApiClient.make(Api, {
      transformClient: (client) =>
        client.pipe(
          HttpClient.mapRequest((request) => {
            const authenticatedRequest = HttpClientRequest.setHeaders(
              request,
              sessionIdentityHeaders()
            )
            if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
              return HttpClientRequest.setHeader(
                authenticatedRequest,
                "X-CSRF-Token",
                getCsrfToken() || ""
              )
            }
            return authenticatedRequest
          })
        ),
    })
  ).pipe(
    Layer.provide(
      Layer.succeed(FetchHttpClient.RequestInit, {
        credentials: "include",
      })
    ),
    Layer.provide(FetchHttpClient.layer)
  )
}

export const client = Effect.runSync(Effect.provide(ApiClient, ApiClient.layer))

import { Context, Effect, Layer } from "effect"
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "effect/unstable/http"
import { HttpApiClient } from "effect/unstable/httpapi"
import { Api } from "./Api"
import { getCsrfToken } from "../../utils"

const getIdentityMeta = (name: string) =>
  typeof document === "undefined"
    ? undefined
    : document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content

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
            let authenticatedRequest = request
            const userId = getIdentityMeta("lynvo-user-id")
            const sessionId = getIdentityMeta("lynvo-session-id")
            if (userId && sessionId) {
              authenticatedRequest = HttpClientRequest.setHeaders(request, {
                "X-Lynvo-Expected-User-Id": userId,
                "X-Lynvo-Expected-Session-Id": sessionId,
              })
            }
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

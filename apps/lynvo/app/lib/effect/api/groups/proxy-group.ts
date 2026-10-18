import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api"

import {
  ProxyProviderStateSchema,
  RefreshProxyBalanceResponseSchema,
  SetProxyKeyPayloadSchema,
  SetProxyKeyResponseSchema,
} from "../../../api-contracts"
import {
  BackendApiError,
  CsrfApiError,
  PluginServerRegistrationApiError,
  UnauthorizedApiError,
  ValidationApiError,
} from "../../errors"
import { WebAuth, CsrfMiddleware } from "../middleware"
import { withDataVersionResponseSchema } from "../versioned-response"

const SetProxyKeyResponseWithHeadersSchema = withDataVersionResponseSchema(
  SetProxyKeyResponseSchema
)

const RefreshProxyBalanceResponseWithHeadersSchema =
  withDataVersionResponseSchema(RefreshProxyBalanceResponseSchema)

export class ProxyGroup extends HttpApiGroup.make("proxy")
  .add(
    HttpApiEndpoint.get("state", "/", {
      success: ProxyProviderStateSchema,
      error: [UnauthorizedApiError, BackendApiError],
    })
  )
  .add(
    HttpApiEndpoint.post("setKey", "/key", {
      payload: SetProxyKeyPayloadSchema,
      success: SetProxyKeyResponseWithHeadersSchema,
      error: [
        PluginServerRegistrationApiError,
        ValidationApiError,
        UnauthorizedApiError,
        BackendApiError,
        CsrfApiError,
      ],
    })
  )
  .add(
    HttpApiEndpoint.post("refreshBalance", "/balance/refresh", {
      success: RefreshProxyBalanceResponseWithHeadersSchema,
      error: [
        PluginServerRegistrationApiError,
        UnauthorizedApiError,
        BackendApiError,
        CsrfApiError,
      ],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/proxy") {}

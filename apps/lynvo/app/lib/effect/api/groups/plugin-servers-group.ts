import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { WebAuth, CsrfMiddleware } from "../middleware"
import {
  UnauthorizedApiError,
  CsrfApiError,
  ValidationApiError,
  PluginServerRegistrationApiError,
  BackendApiError,
} from "../../errors"
import {
  CreatePluginServerPayloadSchema,
  MutationResultSchema,
  PluginServerListSchema,
  PluginServerUsageListSchema,
  RefreshProxyBalanceResponseSchema,
  SetProxyKeyPayloadSchema,
  SetProxyKeyResponseSchema,
  TogglePluginServerPayloadSchema,
} from "../../../api-contracts"

export class PluginServersGroup extends HttpApiGroup.make("pluginServers")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: PluginServerListSchema,
      error: [UnauthorizedApiError, BackendApiError],
    }),
    HttpApiEndpoint.get("usage", "/usage", {
      success: PluginServerUsageListSchema,
      error: [UnauthorizedApiError, BackendApiError],
    }),
    HttpApiEndpoint.post("create", "/", {
      payload: CreatePluginServerPayloadSchema,
      success: MutationResultSchema,
      error: [
        PluginServerRegistrationApiError,
        ValidationApiError,
        UnauthorizedApiError,
        BackendApiError,
        CsrfApiError,
      ],
    }),
    HttpApiEndpoint.post("toggle", "/:pluginServerId/toggle", {
      params: {
        pluginServerId: Schema.String,
      },
      payload: TogglePluginServerPayloadSchema,
      success: MutationResultSchema,
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    }),
    HttpApiEndpoint.post("toggleProxy", "/:pluginServerId/proxy-toggle", {
      params: {
        pluginServerId: Schema.String,
      },
      payload: TogglePluginServerPayloadSchema,
      success: MutationResultSchema,
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    }),
    HttpApiEndpoint.post("refresh", "/:pluginServerId/refresh", {
      params: {
        pluginServerId: Schema.String,
      },
      success: MutationResultSchema,
      error: [
        PluginServerRegistrationApiError,
        UnauthorizedApiError,
        BackendApiError,
        CsrfApiError,
      ],
    }),
    HttpApiEndpoint.post("setProxyKey", "/:pluginServerId/proxy-key", {
      params: {
        pluginServerId: Schema.String,
      },
      payload: SetProxyKeyPayloadSchema,
      success: SetProxyKeyResponseSchema,
      error: [
        PluginServerRegistrationApiError,
        ValidationApiError,
        UnauthorizedApiError,
        BackendApiError,
        CsrfApiError,
      ],
    }),
    HttpApiEndpoint.post(
      "refreshProxyBalance",
      "/:pluginServerId/proxy-balance/refresh",
      {
        params: {
          pluginServerId: Schema.String,
        },
        success: RefreshProxyBalanceResponseSchema,
        error: [
          PluginServerRegistrationApiError,
          UnauthorizedApiError,
          BackendApiError,
          CsrfApiError,
        ],
      }
    ),
    HttpApiEndpoint.delete("delete", "/:pluginServerId", {
      params: {
        pluginServerId: Schema.String,
      },
      success: MutationResultSchema,
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/plugin-servers") {}

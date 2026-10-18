import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api"

import {
  CreatePluginServerPayloadSchema,
  PluginServerListSchema,
  PluginServerUsageListSchema,
  TogglePluginServerPayloadSchema,
} from "../../../api-contracts"
import {
  UnauthorizedApiError,
  CsrfApiError,
  ValidationApiError,
  PluginServerRegistrationApiError,
  BackendApiError,
} from "../../errors"
import { WebAuth, CsrfMiddleware } from "../middleware"
import { VersionedMutationResponseSchema } from "../versioned-response"

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
      success: VersionedMutationResponseSchema,
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
      success: VersionedMutationResponseSchema,
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    }),
    HttpApiEndpoint.post("toggleProxy", "/:pluginServerId/proxy/toggle", {
      params: {
        pluginServerId: Schema.String,
      },
      payload: TogglePluginServerPayloadSchema,
      success: VersionedMutationResponseSchema,
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    }),
    HttpApiEndpoint.post("refresh", "/:pluginServerId/refresh", {
      params: {
        pluginServerId: Schema.String,
      },
      success: VersionedMutationResponseSchema,
      error: [
        PluginServerRegistrationApiError,
        UnauthorizedApiError,
        BackendApiError,
        CsrfApiError,
      ],
    }),
    HttpApiEndpoint.delete("delete", "/:pluginServerId", {
      params: {
        pluginServerId: Schema.String,
      },
      success: VersionedMutationResponseSchema,
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/plugin-servers") {}

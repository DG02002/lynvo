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
import { PluginServerUsageSchema } from "../usage-schemas"

const CustomPluginServerSchema = Schema.Struct({
  id: Schema.String,
  userId: Schema.String,
  baseUrl: Schema.String,
  manifest: Schema.String,
  enabled: Schema.Boolean,
  priority: Schema.Number,
  verificationStatus: Schema.String,
  lastVerifiedAt: Schema.optional(Schema.NullOr(Schema.Number)),
  lastManifestRefreshAt: Schema.optional(Schema.NullOr(Schema.Number)),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})

export class PluginServersGroup extends HttpApiGroup.make("pluginServers")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: Schema.Array(CustomPluginServerSchema),
      error: [UnauthorizedApiError, BackendApiError],
    }),
    HttpApiEndpoint.get("usage", "/usage", {
      success: Schema.Array(PluginServerUsageSchema),
      error: [UnauthorizedApiError, BackendApiError],
    }),
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({
        baseUrl: Schema.String,
        apiKey: Schema.String,
      }),
      success: Schema.Struct({ success: Schema.Boolean }),
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
      payload: Schema.Struct({
        enabled: Schema.Boolean,
      }),
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    }),
    HttpApiEndpoint.post("refresh", "/:pluginServerId/refresh", {
      params: {
        pluginServerId: Schema.String,
      },
      success: Schema.Struct({ success: Schema.Boolean }),
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
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/plugin-servers") {}

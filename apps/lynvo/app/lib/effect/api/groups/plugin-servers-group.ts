import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { WebAuth, CsrfMiddleware } from "../Middleware"
import {
  UnauthorizedApiError,
  CsrfApiError,
  ValidationApiError,
  PluginServerRegistrationApiError,
  ConvexApiError,
} from "../../errors"
import { PluginServerUsageSchema } from "../usage-schemas"

const CustomPluginServerSchema = Schema.Struct({
  _id: Schema.String,
  _creationTime: Schema.Number,
  userId: Schema.String,
  baseUrl: Schema.String,
  manifest: Schema.String,
  enabled: Schema.Boolean,
  priority: Schema.Number,
  verificationStatus: Schema.String,
  lastVerifiedAt: Schema.optional(Schema.Number),
  lastManifestRefreshAt: Schema.optional(Schema.Number),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})

export class PluginServersGroup extends HttpApiGroup.make("pluginServers")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: Schema.Array(CustomPluginServerSchema),
      error: [UnauthorizedApiError, ConvexApiError],
    }),
    HttpApiEndpoint.get("usage", "/usage", {
      success: Schema.Array(PluginServerUsageSchema),
      error: [UnauthorizedApiError, ConvexApiError],
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
        ConvexApiError,
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
      error: [UnauthorizedApiError, CsrfApiError, ConvexApiError],
    }),
    HttpApiEndpoint.post("refresh", "/:pluginServerId/refresh", {
      params: {
        pluginServerId: Schema.String,
      },
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [
        PluginServerRegistrationApiError,
        UnauthorizedApiError,
        ConvexApiError,
        CsrfApiError,
      ],
    }),
    HttpApiEndpoint.delete("delete", "/:pluginServerId", {
      params: {
        pluginServerId: Schema.String,
      },
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedApiError, CsrfApiError, ConvexApiError],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/plugin-servers") {}

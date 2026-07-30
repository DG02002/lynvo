import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { WebAuth, CsrfMiddleware } from "../Middleware"
import {
  UnauthorizedApiError,
  CsrfApiError,
  ConvexApiError,
  CredentialVaultApiError,
  ValidationApiError,
} from "../../errors"

export class PluginDomainsGroup extends HttpApiGroup.make("pluginDomains")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: Schema.Array(Schema.Unknown),
      error: [UnauthorizedApiError, ConvexApiError],
    }),
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({
        domain: Schema.String,
        pluginId: Schema.String,
        username: Schema.optional(Schema.String),
        password: Schema.optional(Schema.String),
      }),
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [
        UnauthorizedApiError,
        CsrfApiError,
        ConvexApiError,
        CredentialVaultApiError,
        ValidationApiError,
      ],
    }),
    HttpApiEndpoint.patch("setCredential", "/:domainId/credential", {
      params: { domainId: Schema.String },
      payload: Schema.Struct({
        username: Schema.optional(Schema.String),
        password: Schema.String,
      }),
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [
        UnauthorizedApiError,
        CsrfApiError,
        ConvexApiError,
        CredentialVaultApiError,
        ValidationApiError,
      ],
    }),
    HttpApiEndpoint.delete("deleteCredential", "/:domainId/credential", {
      params: { domainId: Schema.String },
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedApiError, CsrfApiError, ConvexApiError],
    }),
    HttpApiEndpoint.delete("delete", "/:domainId", {
      params: {
        domainId: Schema.String,
      },
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedApiError, CsrfApiError, ConvexApiError],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/plugin-domains") {}

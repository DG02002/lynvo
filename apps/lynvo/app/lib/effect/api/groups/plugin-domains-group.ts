import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { WebAuth, CsrfMiddleware } from "../middleware"
import {
  UnauthorizedApiError,
  CsrfApiError,
  BackendApiError,
  CredentialVaultApiError,
  ValidationApiError,
} from "../../errors"

export class PluginDomainsGroup extends HttpApiGroup.make("pluginDomains")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: Schema.Array(
        Schema.Struct({
          id: Schema.String,
          userId: Schema.String,
          pluginServerId: Schema.String,
          domain: Schema.String,
          pluginId: Schema.String,
          hasCredential: Schema.Boolean,
        })
      ),
      error: [UnauthorizedApiError, BackendApiError],
    }),
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({
        domain: Schema.String,
        pluginServerId: Schema.String,
        pluginId: Schema.String,
        username: Schema.optional(Schema.String),
        password: Schema.optional(Schema.String),
      }),
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [
        UnauthorizedApiError,
        CsrfApiError,
        BackendApiError,
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
        BackendApiError,
        CredentialVaultApiError,
        ValidationApiError,
      ],
    }),
    HttpApiEndpoint.delete("deleteCredential", "/:domainId/credential", {
      params: { domainId: Schema.String },
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    }),
    HttpApiEndpoint.delete("delete", "/:domainId", {
      params: {
        domainId: Schema.String,
      },
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/plugin-domains") {}

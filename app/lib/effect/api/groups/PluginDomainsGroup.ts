import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { WebAuth, CsrfMiddleware } from "../Middleware"
import {
  UnauthorizedError,
  CsrfError,
  ConvexError,
  CredentialVaultError,
  ValidationError,
} from "../../errors"

export class PluginDomainsGroup extends HttpApiGroup.make("pluginDomains")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: Schema.Array(Schema.Unknown),
      error: [UnauthorizedError, ConvexError],
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
        UnauthorizedError,
        CsrfError,
        ConvexError,
        CredentialVaultError,
        ValidationError,
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
        UnauthorizedError,
        CsrfError,
        ConvexError,
        CredentialVaultError,
        ValidationError,
      ],
    }),
    HttpApiEndpoint.delete("deleteCredential", "/:domainId/credential", {
      params: { domainId: Schema.String },
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedError, CsrfError, ConvexError],
    }),
    HttpApiEndpoint.delete("delete", "/:domainId", {
      params: {
        domainId: Schema.String,
      },
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedError, CsrfError, ConvexError],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/plugin-domains") {}

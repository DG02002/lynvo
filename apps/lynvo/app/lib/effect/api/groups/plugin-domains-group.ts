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
import {
  CreatePluginDomainPayloadSchema,
  MutationResultSchema,
  PluginDomainListSchema,
  SetCredentialPayloadSchema,
} from "../../../api/contracts"

export class PluginDomainsGroup extends HttpApiGroup.make("pluginDomains")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: PluginDomainListSchema,
      error: [UnauthorizedApiError, BackendApiError],
    }),
    HttpApiEndpoint.post("create", "/", {
      payload: CreatePluginDomainPayloadSchema,
      success: MutationResultSchema,
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
      payload: SetCredentialPayloadSchema,
      success: MutationResultSchema,
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
      success: MutationResultSchema,
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    }),
    HttpApiEndpoint.delete("delete", "/:domainId", {
      params: {
        domainId: Schema.String,
      },
      success: MutationResultSchema,
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/plugin-domains") {}

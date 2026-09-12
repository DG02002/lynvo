import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { WebAuth, CsrfMiddleware } from "../middleware"
import {
  UnauthorizedApiError,
  CsrfApiError,
  BackendApiError,
  CredentialVaultApiError,
  ValidationApiError,
  PluginCredentialChangeSupersededApiError,
  PluginDomainNotFoundApiError,
  PluginServerUnavailableApiError,
} from "../../errors"
import {
  CreatePluginDomainPayloadSchema,
  PluginDomainListSchema,
  SetCredentialPayloadSchema,
} from "../../../api-contracts"
import { VersionedMutationResponseSchema } from "../versioned-response"

export class PluginDomainsGroup extends HttpApiGroup.make("pluginDomains")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: PluginDomainListSchema,
      error: [UnauthorizedApiError, BackendApiError],
    }),
    HttpApiEndpoint.post("create", "/", {
      payload: CreatePluginDomainPayloadSchema,
      success: VersionedMutationResponseSchema,
      error: [
        UnauthorizedApiError,
        CsrfApiError,
        BackendApiError,
        PluginServerUnavailableApiError,
        CredentialVaultApiError,
        ValidationApiError,
      ],
    }),
    HttpApiEndpoint.patch("setCredential", "/:domainId/credential", {
      params: { domainId: Schema.String },
      payload: SetCredentialPayloadSchema,
      success: VersionedMutationResponseSchema,
      error: [
        UnauthorizedApiError,
        CsrfApiError,
        BackendApiError,
        PluginDomainNotFoundApiError,
        PluginServerUnavailableApiError,
        PluginCredentialChangeSupersededApiError,
        CredentialVaultApiError,
        ValidationApiError,
      ],
    }),
    HttpApiEndpoint.delete("deleteCredential", "/:domainId/credential", {
      params: { domainId: Schema.String },
      success: VersionedMutationResponseSchema,
      error: [
        UnauthorizedApiError,
        CsrfApiError,
        BackendApiError,
        PluginDomainNotFoundApiError,
        PluginServerUnavailableApiError,
        PluginCredentialChangeSupersededApiError,
      ],
    }),
    HttpApiEndpoint.delete("delete", "/:domainId", {
      params: {
        domainId: Schema.String,
      },
      success: VersionedMutationResponseSchema,
      error: [
        UnauthorizedApiError,
        CsrfApiError,
        BackendApiError,
        PluginDomainNotFoundApiError,
      ],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/plugin-domains") {}

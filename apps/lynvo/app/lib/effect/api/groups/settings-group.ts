import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { CsrfMiddleware, WebAuth } from "../middleware"
import {
  BackendApiError,
  CsrfApiError,
  NotFoundApiError,
  UnauthorizedApiError,
  ValidationApiError,
} from "../../errors"
import {
  ActivityPayloadSchema,
  DeleteAccountPayloadSchema,
  MutationResultSchema,
  PlayerPreferencesSchema,
  UserSessionListSchema,
} from "../../../api-contracts"
import { VersionedMutationResponseSchema } from "../versioned-response"

export class SettingsGroup extends HttpApiGroup.make("settings")
  .add(
    // Session and account state is not snapshot-owned data: these writes do
    // not go through executeOwnedWrite and carry no data_version.
    HttpApiEndpoint.post("touchActivity", "/activity", {
      payload: ActivityPayloadSchema,
      success: MutationResultSchema,
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    }),
    HttpApiEndpoint.get("getPlayerPreferences", "/player", {
      success: PlayerPreferencesSchema,
      error: [UnauthorizedApiError, BackendApiError],
    }),
    HttpApiEndpoint.patch("updatePlayerPreferences", "/player", {
      payload: PlayerPreferencesSchema,
      success: VersionedMutationResponseSchema,
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    }),
    HttpApiEndpoint.get("listSessions", "/security/sessions", {
      success: UserSessionListSchema,
      error: [UnauthorizedApiError, BackendApiError],
    }),
    HttpApiEndpoint.delete("revokeSession", "/security/sessions/:sessionId", {
      params: { sessionId: Schema.String },
      success: MutationResultSchema,
      error: [
        UnauthorizedApiError,
        CsrfApiError,
        NotFoundApiError,
        BackendApiError,
      ],
    }),
    HttpApiEndpoint.delete("revokeAllSessions", "/security/sessions", {
      success: MutationResultSchema,
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    }),
    HttpApiEndpoint.delete("deleteAccount", "/security/account", {
      payload: DeleteAccountPayloadSchema,
      success: MutationResultSchema,
      error: [
        UnauthorizedApiError,
        CsrfApiError,
        ValidationApiError,
        BackendApiError,
      ],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/settings") {}

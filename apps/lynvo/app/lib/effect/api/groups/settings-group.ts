import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { CsrfMiddleware, WebAuth } from "../middleware"
import {
  BackendApiError,
  CsrfApiError,
  UnauthorizedApiError,
} from "../../errors"
import {
  ActivityPayloadSchema,
  DeleteAccountPayloadSchema,
  MutationResultSchema,
  PlayerPreferencesSchema,
  UserSessionListSchema,
} from "../../../api/contracts"

export class SettingsGroup extends HttpApiGroup.make("settings")
  .add(
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
      success: MutationResultSchema,
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    }),
    HttpApiEndpoint.get("listSessions", "/security/sessions", {
      success: UserSessionListSchema,
      error: [UnauthorizedApiError, BackendApiError],
    }),
    HttpApiEndpoint.delete("revokeSession", "/security/sessions/:sessionId", {
      params: { sessionId: Schema.String },
      success: MutationResultSchema,
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    }),
    HttpApiEndpoint.delete("revokeAllSessions", "/security/sessions", {
      success: MutationResultSchema,
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    }),
    HttpApiEndpoint.delete("deleteAccount", "/security/account", {
      payload: DeleteAccountPayloadSchema,
      success: MutationResultSchema,
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/settings") {}

import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { CsrfMiddleware, WebAuth } from "../middleware"
import {
  BackendApiError,
  CsrfApiError,
  UnauthorizedApiError,
} from "../../errors"

const PlayerIdSchema = Schema.Literals(["just", "vlc", "mpv", "mx"])

const PlayerPreferencesSchema = Schema.Struct({
  rangeSupportedPlayerId: Schema.optional(PlayerIdSchema),
  rangeUnsupportedPlayerId: Schema.optional(PlayerIdSchema),
})

const UserSessionSchema = Schema.Struct({
  id: Schema.String,
  deviceName: Schema.String,
  lastActiveAt: Schema.Number,
  createdAt: Schema.Number,
  isCurrent: Schema.Boolean,
})

export class SettingsGroup extends HttpApiGroup.make("settings")
  .add(
    HttpApiEndpoint.post("touchActivity", "/activity", {
      payload: Schema.Struct({ deviceName: Schema.String }),
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    }),
    HttpApiEndpoint.get("getPlayerPreferences", "/player", {
      success: PlayerPreferencesSchema,
      error: [UnauthorizedApiError, BackendApiError],
    }),
    HttpApiEndpoint.patch("updatePlayerPreferences", "/player", {
      payload: PlayerPreferencesSchema,
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    }),
    HttpApiEndpoint.get("listSessions", "/security/sessions", {
      success: Schema.Array(UserSessionSchema),
      error: [UnauthorizedApiError, BackendApiError],
    }),
    HttpApiEndpoint.delete("revokeSession", "/security/sessions/:sessionId", {
      params: { sessionId: Schema.String },
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    }),
    HttpApiEndpoint.delete("revokeAllSessions", "/security/sessions", {
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    }),
    HttpApiEndpoint.delete("deleteAccount", "/security/account", {
      payload: Schema.Struct({ confirmEmail: Schema.String }),
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/settings") {}

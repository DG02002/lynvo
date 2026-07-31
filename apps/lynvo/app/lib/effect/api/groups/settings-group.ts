import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { CsrfMiddleware, WebAuth } from "../Middleware"
import {
  ConvexApiError,
  CsrfApiError,
  UnauthorizedApiError,
} from "../../errors"

const PlayerIdSchema = Schema.Literals(["just", "vlc", "mpv", "mx"])

const PlayerPreferencesSchema = Schema.Struct({
  rangeSupportedPlayerId: Schema.optional(PlayerIdSchema),
  rangeUnsupportedPlayerId: Schema.optional(PlayerIdSchema),
})

const StorageUsageSchema = Schema.Struct({
  estimatedBytes: Schema.Number,
  enforcedBytes: Schema.Number,
  operationalBytes: Schema.Number,
  linkBytes: Schema.Number,
  pluginServerBytes: Schema.Number,
  pluginDomainBytes: Schema.Number,
  authBytes: Schema.Number,
  profileBytes: Schema.Number,
  savedLinkCount: Schema.Number,
  averageLinkBytes: Schema.Number,
  storageLimitBytes: Schema.Number,
  storageWarningBytes: Schema.Number,
  recentCardLimitBytes: Schema.Number,
  retentionDays: Schema.Number,
  retentionDayOptions: Schema.Array(Schema.Number),
  defaultRetentionDays: Schema.Number,
  maxRetentionDays: Schema.Number,
})

export class SettingsGroup extends HttpApiGroup.make("settings")
  .add(
    HttpApiEndpoint.get("getPlayerPreferences", "/player", {
      success: PlayerPreferencesSchema,
      error: [UnauthorizedApiError, ConvexApiError],
    }),
    HttpApiEndpoint.patch("updatePlayerPreferences", "/player", {
      payload: PlayerPreferencesSchema,
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedApiError, CsrfApiError, ConvexApiError],
    }),
    HttpApiEndpoint.get("getStorageUsage", "/storage", {
      success: StorageUsageSchema,
      error: [UnauthorizedApiError, ConvexApiError],
    }),
    HttpApiEndpoint.get("previewStorageRetention", "/storage/retention", {
      query: Schema.Struct({
        days: Schema.NumberFromString,
        timeBucket: Schema.NumberFromString,
      }),
      success: Schema.Struct({ expiredLinkCount: Schema.Number }),
      error: [UnauthorizedApiError, ConvexApiError],
    }),
    HttpApiEndpoint.patch("updateStorageRetention", "/storage/retention", {
      payload: Schema.Struct({
        days: Schema.Number,
        deleteExpiredLinks: Schema.Boolean,
      }),
      success: Schema.Struct({
        success: Schema.Boolean,
        deletedLinks: Schema.Number,
      }),
      error: [UnauthorizedApiError, CsrfApiError, ConvexApiError],
    }),
    HttpApiEndpoint.delete("clearRecentLinks", "/storage/links", {
      success: Schema.Struct({
        success: Schema.Boolean,
        deletedLinks: Schema.Number,
      }),
      error: [UnauthorizedApiError, CsrfApiError, ConvexApiError],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/settings") {}

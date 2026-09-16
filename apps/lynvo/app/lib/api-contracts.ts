import { Schema } from "effect"
import { remoteCommandFieldsSchema } from "./remote-play/wire"
import { PluginServerUsageSchema } from "../../shared/usage-contracts"
export { LynvoUsageSnapshotSchema } from "../../shared/usage-contracts"
export type {
  LynvoUsageSnapshot,
  PluginServerUsage,
  UsageMetric,
} from "../../shared/usage-contracts"

export const MutationResultSchema = Schema.Struct({
  success: Schema.Boolean,
})

export type MutationResult = typeof MutationResultSchema.Type

export const VersionedMutationBodySchema = Schema.Struct({
  success: Schema.Boolean,
  dataVersion: Schema.Number,
})

export type VersionedMutationBody = typeof VersionedMutationBodySchema.Type

const CustomPluginServerSchema = Schema.Struct({
  id: Schema.String,
  userId: Schema.String,
  baseUrl: Schema.String,
  manifest: Schema.String,
  enabled: Schema.Boolean,
  priority: Schema.Number,
  verificationStatus: Schema.String,
  hasProxyKey: Schema.Boolean,
  proxyBalanceRemaining: Schema.optional(Schema.NullOr(Schema.Number)),
  proxyBalanceLimit: Schema.optional(Schema.NullOr(Schema.Number)),
  proxyBalanceCheckedAt: Schema.optional(Schema.NullOr(Schema.Number)),
  proxyEnabled: Schema.Boolean,
  lastVerifiedAt: Schema.optional(Schema.NullOr(Schema.Number)),
  lastManifestRefreshAt: Schema.optional(Schema.NullOr(Schema.Number)),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})

export const CreatePluginServerPayloadSchema = Schema.Struct({
  baseUrl: Schema.String,
  apiKey: Schema.String,
})

export const TogglePluginServerPayloadSchema = Schema.Struct({
  enabled: Schema.Boolean,
})

export const SetProxyKeyPayloadSchema = Schema.Struct({
  token: Schema.String,
})

export const SetProxyKeyResponseSchema = Schema.Struct({
  success: Schema.Boolean,
  remaining: Schema.NullOr(Schema.Number),
  limit: Schema.NullOr(Schema.Number),
  dataVersion: Schema.Number,
})

export const RefreshProxyBalanceResponseSchema = Schema.Struct({
  success: Schema.Boolean,
  remaining: Schema.Number,
  limit: Schema.Number,
  checkedAt: Schema.Number,
  dataVersion: Schema.Number,
})

export const CreatePluginDomainPayloadSchema = Schema.Struct({
  domain: Schema.String,
  pluginServerId: Schema.String,
  pluginId: Schema.String,
  username: Schema.optional(Schema.String),
  password: Schema.optional(Schema.String),
})

export const SetCredentialPayloadSchema = Schema.Struct({
  username: Schema.optional(Schema.String),
  password: Schema.String,
})

const PluginDomainSchema = Schema.Struct({
  id: Schema.String,
  userId: Schema.String,
  pluginServerId: Schema.String,
  domain: Schema.String,
  pluginId: Schema.String,
  hasCredential: Schema.Boolean,
})

export const StorageSettingsSnapshotSchema = Schema.Struct({
  enforcedBytes: Schema.Number,
  linkBytes: Schema.Number,
  pluginServerBytes: Schema.Number,
  pluginDomainBytes: Schema.Number,
  profileBytes: Schema.Number,
  savedLinkCount: Schema.Number,
  averageLinkBytes: Schema.Number,
  storageLimitBytes: Schema.Number,
  storageWarningBytes: Schema.Number,
  linkLimitBytes: Schema.Number,
  retentionDays: Schema.Number,
  retentionDayOptions: Schema.Array(Schema.Number),
  defaultRetentionDays: Schema.Number,
  maxRetentionDays: Schema.Number,
})

export const RetentionPreviewResponseSchema = Schema.Struct({
  expiredLinkCount: Schema.Number,
})

export const UpdateRetentionResponseSchema = Schema.Struct({
  success: Schema.Boolean,
  deletedLinks: Schema.Number,
  dataVersion: Schema.Number,
})

export const ClearLinksResponseSchema = Schema.Struct({
  success: Schema.Boolean,
  replayed: Schema.Boolean,
  deletedLinks: Schema.Number,
  dataVersion: Schema.Number,
})

export const RemoteSendPayloadSchema = Schema.Struct({
  target_session_id: Schema.String,
  command: Schema.Literal("play"),
  data: Schema.optional(Schema.Unknown),
})

export const ExtractQuerySchema = Schema.Struct({
  url: Schema.String,
  pluginServerId: Schema.optional(Schema.String),
  pluginId: Schema.optional(Schema.String),
  kind: Schema.optional(Schema.String),
})

export const MetadataQuerySchema = Schema.Struct({
  url: Schema.String,
  pluginServerId: Schema.optional(Schema.String),
  pluginId: Schema.optional(Schema.String),
})

export const RemotePollQuerySchema = Schema.Struct({
  receiverId: Schema.String,
})

const RemoteCommandSchema = remoteCommandFieldsSchema

export const RemotePollResponseSchema = Schema.Struct({
  commands: Schema.Array(RemoteCommandSchema),
  dataVersion: Schema.Number,
})

export const RemoteResultPayloadSchema = Schema.Struct({
  id: Schema.String,
  claimToken: Schema.String,
  receiverId: Schema.String,
  result: Schema.Union([Schema.Literal("applied"), Schema.Literal("failed")]),
  message: Schema.optional(Schema.String),
})

export const ActivityPayloadSchema = Schema.Struct({
  deviceName: Schema.String,
})

export const PlayerIdSchema = Schema.Literals(["just", "vlc", "mpv", "mx"])

export const PlayerPreferencesSchema = Schema.Struct({
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

export const DeleteAccountPayloadSchema = Schema.Struct({
  confirmEmail: Schema.String,
})

export const PluginServerListSchema = Schema.Array(CustomPluginServerSchema)
export const PluginServerUsageListSchema = Schema.Array(PluginServerUsageSchema)
export const PluginDomainListSchema = Schema.Array(PluginDomainSchema)
export const UserSessionListSchema = Schema.Array(UserSessionSchema)

export type CreatePluginServerPayload =
  typeof CreatePluginServerPayloadSchema.Type
export type TogglePluginServerPayload =
  typeof TogglePluginServerPayloadSchema.Type
export type SetProxyKeyPayload = typeof SetProxyKeyPayloadSchema.Type
export type SetProxyKeyResponse = typeof SetProxyKeyResponseSchema.Type
export type RefreshProxyBalanceResponse =
  typeof RefreshProxyBalanceResponseSchema.Type
export type CreatePluginDomainPayload =
  typeof CreatePluginDomainPayloadSchema.Type
export type SetCredentialPayload = typeof SetCredentialPayloadSchema.Type
export type StorageSettingsSnapshot = typeof StorageSettingsSnapshotSchema.Type
export type UpdateRetentionResponse = typeof UpdateRetentionResponseSchema.Type
export type ClearLinksResponse = typeof ClearLinksResponseSchema.Type
export type RemoteSendPayload = typeof RemoteSendPayloadSchema.Type
export type ExtractQuery = typeof ExtractQuerySchema.Type
export type MetadataQuery = typeof MetadataQuerySchema.Type
export type RemotePollQuery = typeof RemotePollQuerySchema.Type
export type RemotePollResponse = typeof RemotePollResponseSchema.Type
export type RemoteResultPayload = typeof RemoteResultPayloadSchema.Type
export type ActivityPayload = typeof ActivityPayloadSchema.Type
export type PlayerId = typeof PlayerIdSchema.Type
export type PlayerPreferences = typeof PlayerPreferencesSchema.Type
export type DeleteAccountPayload = typeof DeleteAccountPayloadSchema.Type
export type PluginServerList = typeof PluginServerListSchema.Type
export type PluginServerUsageList = typeof PluginServerUsageListSchema.Type
export type PluginDomainList = typeof PluginDomainListSchema.Type
export type UserSessionList = typeof UserSessionListSchema.Type

export interface ProfileUserRow {
  id: string
  google_subject: string
  email: string
  display_name: string | null
  avatar_url: string | null
  erasure_pending_at: number | null
  storage_retention_days: number
  range_supported_player_id: string | null
  range_unsupported_player_id: string | null
  created_at: number
}

export const profileStorageDocument = (
  row: ProfileUserRow
): ProfileUserRow => ({
  id: row.id,
  google_subject: row.google_subject,
  email: row.email,
  display_name: row.display_name,
  avatar_url: row.avatar_url,
  erasure_pending_at: row.erasure_pending_at,
  storage_retention_days: row.storage_retention_days,
  range_supported_player_id: row.range_supported_player_id,
  range_unsupported_player_id: row.range_unsupported_player_id,
  created_at: row.created_at,
})

export interface LinkRow {
  id: string
  user_id: string
  url: string
  title: string | null
  meta_json: string | null
  opened_at: number | null
  created_at: number
  updated_at: number
  expires_at: number | null
  extraction_state: "queued" | "running" | "complete" | "failed"
  extraction_error: string | null
  extraction_attempts: number
  extraction_available_at: number | null
  extraction_lease_expires_at: number | null
}

export interface PluginServerRow {
  id: string
  user_id: string
  base_url: string
  normalized_base_url: string
  api_key_ciphertext: string | null
  api_key_nonce: string | null
  api_key_algorithm: "AES-256-GCM" | null
  api_key_version: number | null
  credential_status: "pending" | "ready" | "failed"
  credential_generation: number | null
  credential_attempt_id: string | null
  pending_expires_at: number | null
  failure_reason: string | null
  manifest: string
  enabled: number
  priority: number
  verification_status: string
  last_verified_at: number | null
  last_manifest_refresh_at: number | null
  created_at: number
  updated_at: number
}

export interface PluginDomainRow {
  id: string
  user_id: string
  plugin_server_id: string
  domain: string
  plugin_id: string
  credential_generation: number | null
  credential_attempt_id: string | null
  credential_finalized_attempt_id: string | null
}

export interface PluginCredentialRow {
  id: string
  user_id: string
  plugin_domain_id: string
  plugin_server_id: string
  plugin_id: string
  domain: string
  ciphertext: string
  nonce: string
  algorithm: "AES-256-GCM"
  key_version: number
  created_at: number
  updated_at: number
}

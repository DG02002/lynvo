CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_subject TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  data_version INTEGER NOT NULL DEFAULT 1,
  erasure_pending_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  generation INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  user_agent TEXT
);
CREATE INDEX sessions_by_user_id ON sessions(user_id);
CREATE INDEX sessions_by_expires_at ON sessions(expires_at);

CREATE TABLE links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  meta_json TEXT,
  opened_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER,
  UNIQUE(user_id, url)
);
CREATE INDEX links_by_user_created ON links(user_id, created_at);
CREATE INDEX links_by_expires_at ON links(expires_at);

CREATE TABLE link_command_operations (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL,
  link_id TEXT REFERENCES links(id) ON DELETE SET NULL,
  command TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, operation_id)
);
CREATE INDEX link_command_operations_by_expires_at ON link_command_operations(expires_at);

CREATE TABLE device_codes (
  code TEXT PRIMARY KEY,
  poll_secret_digest TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'authorized', 'exchanging', 'consumed')),
  device_name TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  exchange_attempt_id TEXT,
  exchange_generation INTEGER,
  exchange_lease_expires_at INTEGER,
  exchange_session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  consumed_session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX device_codes_by_expires_at ON device_codes(expires_at);
CREATE INDEX device_codes_by_user_id ON device_codes(user_id);

CREATE TABLE storage_ledgers (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  schema_version INTEGER NOT NULL,
  profile_bytes INTEGER NOT NULL,
  link_bytes INTEGER NOT NULL,
  plugin_server_bytes INTEGER NOT NULL,
  plugin_domain_bytes INTEGER NOT NULL,
  plugin_credential_bytes INTEGER NOT NULL,
  saved_link_count INTEGER NOT NULL,
  total_enforced_bytes INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE account_erasures (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (
    stage IN (
      'links',
      'pluginCredentials',
      'pluginDomains',
      'pluginServers',
      'deviceCodes',
      'remoteCommands',
      'usageCounters',
      'storageLedgers',
      'accounts',
      'sessions',
      'finalize'
    )
  ),
  trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('manual', 'inactive')),
  started_at INTEGER NOT NULL,
  cleanup_processed_users INTEGER,
  cleanup_started_at INTEGER
);
CREATE INDEX account_erasures_by_user_id ON account_erasures(user_id);

CREATE TABLE usage_counters (
  owner_key TEXT NOT NULL,
  metric_id TEXT NOT NULL,
  period_key TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  used INTEGER NOT NULL,
  PRIMARY KEY (owner_key, metric_id, period_key, epoch)
);

CREATE TABLE usage_epochs (
  epoch INTEGER PRIMARY KEY,
  updated_at INTEGER NOT NULL
);

CREATE TABLE managed_extraction_operations (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL,
  plugin_id TEXT NOT NULL CHECK (
    plugin_id IN (
      'bhadoo-google-drive-index',
      'google-drive-public-files',
      'onedrive-index',
      'direct-media'
    )
  ),
  state TEXT NOT NULL CHECK (state IN ('reserved', 'consumed', 'released')),
  epoch INTEGER NOT NULL,
  daily_period_key TEXT NOT NULL,
  monthly_period_key TEXT NOT NULL,
  user_limits_applied INTEGER NOT NULL,
  reserved_at INTEGER NOT NULL,
  lease_expires_at INTEGER NOT NULL,
  settled_at INTEGER,
  PRIMARY KEY (user_id, operation_id)
);
CREATE INDEX managed_extraction_operations_by_state_lease ON managed_extraction_operations(state, lease_expires_at);

CREATE TABLE user_plugin_servers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL,
  normalized_base_url TEXT NOT NULL,
  api_key_ciphertext TEXT,
  api_key_nonce TEXT,
  api_key_algorithm TEXT CHECK (api_key_algorithm = 'AES-256-GCM'),
  api_key_version INTEGER,
  credential_status TEXT NOT NULL CHECK (credential_status IN ('pending', 'ready', 'failed')),
  credential_generation INTEGER,
  credential_attempt_id TEXT,
  pending_expires_at INTEGER,
  failure_reason TEXT,
  manifest TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  priority INTEGER NOT NULL,
  verification_status TEXT NOT NULL,
  last_verified_at INTEGER,
  last_manifest_refresh_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, normalized_base_url)
);

CREATE TABLE user_plugin_domains (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plugin_server_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  credential_generation INTEGER,
  credential_attempt_id TEXT,
  credential_finalized_attempt_id TEXT
);
CREATE INDEX user_plugin_domains_by_user_domain ON user_plugin_domains(user_id, domain);
CREATE INDEX user_plugin_domains_by_user_server ON user_plugin_domains(user_id, plugin_server_id);
CREATE INDEX user_plugin_domains_by_user_server_domain ON user_plugin_domains(user_id, plugin_server_id, domain);

CREATE TABLE user_plugin_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plugin_domain_id TEXT NOT NULL REFERENCES user_plugin_domains(id) ON DELETE CASCADE,
  plugin_server_id TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  nonce TEXT NOT NULL,
  algorithm TEXT NOT NULL CHECK (algorithm = 'AES-256-GCM'),
  key_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX user_plugin_credentials_by_domain ON user_plugin_credentials(plugin_domain_id);
CREATE INDEX user_plugin_credentials_by_user_domain ON user_plugin_credentials(user_id, domain);
CREATE INDEX user_plugin_credentials_by_user_server_domain ON user_plugin_credentials(user_id, plugin_server_id, domain);

CREATE TABLE remote_commands (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  target_receiver_id TEXT NOT NULL,
  command TEXT NOT NULL CHECK (command = 'play'),
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'claimed', 'applied', 'failed')),
  available_at INTEGER,
  notification_pending INTEGER,
  claim_token TEXT,
  claim_expires_at INTEGER,
  result_message TEXT
);
CREATE INDEX remote_commands_by_user_target_created ON remote_commands(user_id, target_session_id, created_at);
CREATE INDEX remote_commands_by_claim_availability ON remote_commands(
  user_id,
  target_session_id,
  target_receiver_id,
  status,
  available_at,
  created_at
);
CREATE INDEX remote_commands_by_notification_pending ON remote_commands(notification_pending, created_at);
CREATE INDEX remote_commands_by_expires_at ON remote_commands(expires_at);

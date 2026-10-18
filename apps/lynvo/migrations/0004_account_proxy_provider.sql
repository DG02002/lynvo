-- Proxy keys move from per-server storage to one account-level key per
-- provider. Per-server proxy switches stay on user_plugin_servers.
CREATE TABLE user_proxy_providers (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider = 'scrape-do'),
  token_ciphertext TEXT,
  token_nonce TEXT,
  token_algorithm TEXT CHECK (token_algorithm IS NULL OR token_algorithm = 'AES-256-GCM'),
  token_version INTEGER,
  balance_remaining INTEGER,
  balance_limit INTEGER,
  balance_checked_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, provider)
);

-- Migrate existing per-server keys: the earliest-updated server row per
-- account wins (INSERT OR IGNORE keeps the first row per primary key from
-- the ordered select). Storage ledgers keep counting the dropped column
-- bytes in plugin_server_bytes until they are reconstructed; the small
-- overstatement is conservative and self-corrects on reconstruction.
INSERT OR IGNORE INTO user_proxy_providers (
  user_id,
  provider,
  token_ciphertext,
  token_nonce,
  token_algorithm,
  token_version,
  balance_remaining,
  balance_limit,
  balance_checked_at,
  created_at,
  updated_at
)
SELECT
  user_id,
  'scrape-do',
  proxy_token_ciphertext,
  proxy_token_nonce,
  proxy_token_algorithm,
  proxy_token_version,
  proxy_balance_remaining,
  proxy_balance_limit,
  proxy_balance_checked_at,
  created_at,
  updated_at
FROM user_plugin_servers
WHERE proxy_token_ciphertext IS NOT NULL
ORDER BY user_id, updated_at, created_at;

ALTER TABLE user_plugin_servers DROP COLUMN proxy_token_ciphertext;
ALTER TABLE user_plugin_servers DROP COLUMN proxy_token_nonce;
ALTER TABLE user_plugin_servers DROP COLUMN proxy_token_algorithm;
ALTER TABLE user_plugin_servers DROP COLUMN proxy_token_version;
ALTER TABLE user_plugin_servers DROP COLUMN proxy_balance_remaining;
ALTER TABLE user_plugin_servers DROP COLUMN proxy_balance_limit;
ALTER TABLE user_plugin_servers DROP COLUMN proxy_balance_checked_at;

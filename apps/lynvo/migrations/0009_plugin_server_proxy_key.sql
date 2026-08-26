-- A user-supplied Scrape.do proxy key for a Custom Plugin Server. Extractions
-- through a server with a saved proxy key bill the user's own Scrape.do
-- account instead of the server's shared proxy credits.
ALTER TABLE user_plugin_servers ADD COLUMN proxy_token_ciphertext TEXT;
ALTER TABLE user_plugin_servers ADD COLUMN proxy_token_nonce TEXT;
ALTER TABLE user_plugin_servers ADD COLUMN proxy_token_algorithm TEXT CHECK (proxy_token_algorithm IS NULL OR proxy_token_algorithm = 'AES-256-GCM');
ALTER TABLE user_plugin_servers ADD COLUMN proxy_token_version INTEGER;
ALTER TABLE user_plugin_servers ADD COLUMN proxy_balance_remaining INTEGER;
ALTER TABLE user_plugin_servers ADD COLUMN proxy_balance_limit INTEGER;
ALTER TABLE user_plugin_servers ADD COLUMN proxy_balance_checked_at INTEGER;

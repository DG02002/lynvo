-- The hourly registration sweep scans for pending registrations past their
-- expiry; a partial index covers exactly that predicate instead of scanning
-- every user's servers.
CREATE INDEX user_plugin_servers_pending_sweep
  ON user_plugin_servers(pending_expires_at)
  WHERE credential_status != 'ready';

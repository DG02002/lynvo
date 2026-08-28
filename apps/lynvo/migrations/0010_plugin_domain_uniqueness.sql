-- Concurrent upserts could historically create duplicate plugin domain and
-- credential rows; deduplicate before enforcing uniqueness.

DELETE FROM user_plugin_credentials
WHERE id NOT IN (
  SELECT kept.id
  FROM user_plugin_domains d
  JOIN user_plugin_credentials kept
    ON kept.plugin_domain_id = d.id
   AND kept.rowid = (
    SELECT c.rowid
    FROM user_plugin_credentials c
    WHERE c.plugin_domain_id = d.id
    ORDER BY c.updated_at DESC, c.rowid DESC
    LIMIT 1
  )
);

DELETE FROM user_plugin_domains
WHERE id NOT IN (
  SELECT d.id
  FROM user_plugin_domains d
  WHERE d.rowid = (
    SELECT d2.rowid
    FROM user_plugin_domains d2
    WHERE d2.user_id = d.user_id
      AND d2.plugin_server_id = d.plugin_server_id
      AND d2.domain = d.domain
    ORDER BY d2.rowid
    LIMIT 1
  )
);

CREATE UNIQUE INDEX user_plugin_credentials_unique
  ON user_plugin_credentials(plugin_domain_id);

CREATE UNIQUE INDEX user_plugin_domains_unique
  ON user_plugin_domains(user_id, plugin_server_id, domain);

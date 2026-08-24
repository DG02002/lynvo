CREATE TABLE title_sources_next (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_entry_id TEXT NOT NULL REFERENCES title_entries(id) ON DELETE CASCADE,
  saved_link_id TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  occurrence_key TEXT NOT NULL,
  node_key TEXT NOT NULL,
  node_path TEXT NOT NULL,
  label TEXT NOT NULL,
  source_name TEXT NOT NULL,
  quality TEXT,
  size TEXT,
  status TEXT CHECK (status IN ('up', 'down')),
  media_node_kind TEXT CHECK (media_node_kind IN ('group', 'resolvable', 'playable')),
  resolution_kind TEXT CHECK (resolution_kind IN ('folder', 'mirrors')),
  target_url TEXT,
  node_json TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(title_entry_id, saved_link_id, node_key)
);

INSERT INTO title_sources_next
SELECT * FROM title_sources;

DROP TABLE title_sources;
ALTER TABLE title_sources_next RENAME TO title_sources;

CREATE INDEX title_sources_by_saved_link ON title_sources(saved_link_id);
CREATE INDEX title_sources_by_entry ON title_sources(title_entry_id, timestamp DESC);

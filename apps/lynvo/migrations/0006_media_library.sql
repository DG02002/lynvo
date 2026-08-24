CREATE TABLE title_groups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  identity_key TEXT NOT NULL,
  media_kind TEXT NOT NULL CHECK (media_kind IN ('movie', 'tv-season', 'unmatched')),
  display_title TEXT NOT NULL,
  year INTEGER,
  season_number INTEGER,
  metadata_state TEXT NOT NULL CHECK (metadata_state IN ('pending', 'available', 'unavailable', 'failed')),
  provider TEXT,
  provider_id TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  overview TEXT,
  metadata_fetched_at INTEGER,
  metadata_expires_at INTEGER,
  last_added_at INTEGER NOT NULL,
  source_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, identity_key)
);
CREATE INDEX title_groups_by_user_last_added ON title_groups(user_id, last_added_at DESC);

CREATE TABLE title_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_group_id TEXT NOT NULL REFERENCES title_groups(id) ON DELETE CASCADE,
  entry_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('movie', 'episode', 'episode-range', 'container', 'unknown')),
  season_number INTEGER,
  episode_start INTEGER,
  episode_end INTEGER,
  display_label TEXT NOT NULL,
  metadata_state TEXT NOT NULL CHECK (metadata_state IN ('pending', 'available', 'unavailable', 'failed')),
  still_path TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(title_group_id, entry_key)
);
CREATE INDEX title_entries_by_group ON title_entries(title_group_id, entry_key);

CREATE TABLE title_sources (
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
CREATE INDEX title_sources_by_saved_link ON title_sources(saved_link_id);
CREATE INDEX title_sources_by_entry ON title_sources(title_entry_id, timestamp DESC);

CREATE TABLE media_metadata_cache (
  id TEXT PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  media_kind TEXT NOT NULL CHECK (media_kind IN ('movie', 'tv', 'season', 'episode')),
  provider_id TEXT,
  season_number INTEGER,
  episode_number INTEGER,
  payload_json TEXT NOT NULL,
  attribution TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX media_metadata_cache_by_expiry ON media_metadata_cache(expires_at);

CREATE TABLE media_metadata_jobs (
  id TEXT PRIMARY KEY,
  job_key TEXT NOT NULL UNIQUE,
  requested_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title_group_id TEXT REFERENCES title_groups(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  media_kind TEXT NOT NULL CHECK (media_kind IN ('movie', 'tv', 'season', 'episode')),
  title TEXT NOT NULL,
  year INTEGER,
  season_number INTEGER,
  episode_number INTEGER,
  state TEXT NOT NULL CHECK (state IN ('pending', 'running', 'succeeded', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  available_at INTEGER NOT NULL,
  lease_expires_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX media_metadata_jobs_by_state ON media_metadata_jobs(state, available_at, lease_expires_at);
CREATE INDEX media_metadata_jobs_by_user ON media_metadata_jobs(requested_user_id, state, available_at);

CREATE TABLE media_metadata_request_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE INDEX media_metadata_request_log_by_created ON media_metadata_request_log(created_at);
CREATE INDEX media_metadata_request_log_by_user_created ON media_metadata_request_log(user_id, created_at);

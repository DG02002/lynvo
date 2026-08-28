-- The media-library schema (migrations 0006-0008) was created ahead of a
-- feature that never shipped; nothing references these tables. Drop them so
-- the schema stops carrying unwatched, unbounded tables. The DDL remains in
-- git history if the feature returns.
DROP TABLE IF EXISTS media_metadata_request_log;
DROP TABLE IF EXISTS media_metadata_jobs;
DROP TABLE IF EXISTS media_metadata_cache;
DROP TABLE IF EXISTS title_sources;
DROP TABLE IF EXISTS title_entries;
DROP TABLE IF EXISTS title_groups;

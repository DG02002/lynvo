ALTER TABLE links ADD COLUMN extraction_state TEXT NOT NULL DEFAULT 'complete' CHECK (extraction_state IN ('queued', 'running', 'complete', 'failed'));
ALTER TABLE links ADD COLUMN extraction_error TEXT;
ALTER TABLE links ADD COLUMN extraction_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE links ADD COLUMN extraction_available_at INTEGER;
ALTER TABLE links ADD COLUMN extraction_lease_expires_at INTEGER;

CREATE INDEX links_by_extraction_queue ON links(
  extraction_state,
  extraction_available_at,
  extraction_lease_expires_at,
  created_at
);

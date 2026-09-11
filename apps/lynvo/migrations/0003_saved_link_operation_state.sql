ALTER TABLE link_command_operations
ADD COLUMN state TEXT NOT NULL DEFAULT 'completed'
CHECK (state IN ('reserved', 'completed'));

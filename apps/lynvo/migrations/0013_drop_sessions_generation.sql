-- sessions.generation was written at creation and never read; the device-code
-- protocol carries its own exchange_generation on device_codes.
ALTER TABLE sessions DROP COLUMN generation;

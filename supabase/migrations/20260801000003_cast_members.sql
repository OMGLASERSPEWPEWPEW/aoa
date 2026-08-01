-- Add cast_members column to events table
-- Stores array of cast/ensemble: [{name, role, photo_url}]
ALTER TABLE events ADD COLUMN IF NOT EXISTS cast_members jsonb;

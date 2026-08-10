-- Fix: NULL raw_address breaks UNIQUE constraint (PostgreSQL treats NULLs as distinct)

-- Step 1: Drop the old broken constraint
ALTER TABLE public.venue_discovery_queue DROP CONSTRAINT IF EXISTS venue_discovery_queue_source_id_raw_name_raw_address_key;

-- Step 2: Clean up duplicate rows FIRST (keep oldest per source+name)
DELETE FROM public.venue_discovery_queue a
USING public.venue_discovery_queue b
WHERE a.source_id = b.source_id
  AND a.raw_name = b.raw_name
  AND a.id != b.id
  AND a.created_at > b.created_at;

-- Step 3: Create unique index that works with NULLs
CREATE UNIQUE INDEX IF NOT EXISTS uq_vdq_source_name
  ON public.venue_discovery_queue (source_id, raw_name)
  WHERE promoted = false;

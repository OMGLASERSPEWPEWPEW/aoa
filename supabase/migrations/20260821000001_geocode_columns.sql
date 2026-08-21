-- sv4-mig-geocode-cols: bookkeeping for geocode source/status on venues, address on schools

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS geocode_source text,
  ADD COLUMN IF NOT EXISTS geocode_status text;

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS address text;

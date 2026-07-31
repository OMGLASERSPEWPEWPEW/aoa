-- Phase 0, Node: schema-privacy
-- Per-user control over sharing reflections with friends

alter table public.profiles add column share_reflections boolean not null default true;

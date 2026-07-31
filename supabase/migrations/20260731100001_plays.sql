-- Phase 0, Node: schema-plays
-- The play (the work) distinct from the production (the event)

create table public.plays (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  playwright text not null,
  year_written int,
  awards text[] not null default '{}',
  synopsis text,
  created_at timestamptz not null default now()
);

alter table public.plays enable row level security;

create policy "Anyone can read plays"
  on public.plays for select
  using (true);

alter table public.events add column play_id uuid references public.plays(id);
create index idx_events_play_id on public.events (play_id);

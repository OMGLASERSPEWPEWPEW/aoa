-- Site profiles: machine-learned per-domain crawl hints
-- Warm starts cut per-venue cost from 30-90 fetches to 5-8

create table if not exists site_profiles (
  id                    uuid primary key default gen_random_uuid(),
  domain                text not null unique,
  venue_id              uuid references venues(id),
  platform              text,
  tier_required         smallint not null default 1,
  render_needed         boolean not null default false,
  entry_points          jsonb not null default '[]'::jsonb,
  url_patterns          jsonb not null default '[]'::jsonb,
  dead_end_patterns     jsonb not null default '[]'::jsonb,
  robots                jsonb,
  address               text,
  last_success_at       timestamptz,
  last_completeness     numeric,
  consecutive_failures  int not null default 0,
  profile_version       int not null default 1,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists site_profiles_venue_idx on site_profiles(venue_id);

alter table site_profiles enable row level security;

create policy "site_profiles_anon_select" on site_profiles
  for select using (true);

create policy "site_profiles_service_write" on site_profiles
  for all using (auth.role() = 'service_role');

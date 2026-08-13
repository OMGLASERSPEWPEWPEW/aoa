-- artists: performers, directors, designers
create table if not exists artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  headshot_url text,
  bio text,
  affiliation text,
  hometown text,
  external_urls jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- credits: link artists to events
create table if not exists credits (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  role text,
  credit_type text not null check (credit_type in ('performer','director','designer','writer','crew')),
  billing_order int,
  source text not null default 'internal' check (source in ('internal','public_listing','user_submitted')),
  created_at timestamptz not null default now()
);

create unique index if not exists credits_artist_event_role on credits (artist_id, event_id, coalesce(role, ''));
create index if not exists credits_event_id on credits (event_id);

-- artist follows
create table if not exists artist_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

-- artist emotion aggregate (signature feature: "what rooms feel when she's in them")
create table if not exists artist_emotion_counts (
  artist_id uuid not null references artists(id) on delete cascade,
  emotion text not null,
  weight numeric not null default 0,
  primary key (artist_id, emotion)
);

-- RLS
alter table artists enable row level security;
alter table credits enable row level security;
alter table artist_follows enable row level security;
alter table artist_emotion_counts enable row level security;

create policy "Artists are publicly readable" on artists for select using (true);
create policy "Credits are publicly readable" on credits for select using (true);
create policy "Artist emotion counts are publicly readable" on artist_emotion_counts for select using (true);

create policy "Users can read own follows" on artist_follows for select using (auth.uid() = user_id);
create policy "Users can insert own follows" on artist_follows for insert with check (auth.uid() = user_id);
create policy "Users can delete own follows" on artist_follows for delete using (auth.uid() = user_id);

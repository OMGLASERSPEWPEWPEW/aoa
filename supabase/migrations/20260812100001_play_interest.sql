-- play_interest: wanting a play, scoped to a city, persists with no production
create table if not exists play_interest (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  play_id uuid not null references plays(id) on delete cascade,
  city text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists play_interest_user_play on play_interest (user_id, play_id);
create index if not exists play_interest_play_city on play_interest (play_id, city);

alter table play_interest enable row level security;

create policy "Users can read own play interests"
  on play_interest for select using (auth.uid() = user_id);

create policy "Users can insert own play interests"
  on play_interest for insert with check (auth.uid() = user_id);

create policy "Users can delete own play interests"
  on play_interest for delete using (auth.uid() = user_id);

-- Aggregate waiting counts (never expose individual waiters beyond friends)
create or replace view play_waiting_counts as
select play_id, city, count(*)::int as waiting
from play_interest group by play_id, city;

-- Monthly trend for sparkline
create or replace view play_waiting_trend as
select play_id, city, date_trunc('month', created_at) as month, count(*)::int as added
from play_interest group by play_id, city, date_trunc('month', created_at);

-- Play-level emotion aggregate (across all productions of a play)
create table if not exists play_emotion_counts (
  play_id uuid not null references plays(id) on delete cascade,
  emotion text not null,
  weight numeric not null default 0,
  primary key (play_id, emotion)
);

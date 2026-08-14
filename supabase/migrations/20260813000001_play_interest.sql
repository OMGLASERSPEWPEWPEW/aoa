-- play_interest: want attached to the work, not a production
create table public.play_interest (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  play_id     uuid not null references public.plays(id) on delete cascade,
  city        text not null,
  created_at  timestamptz not null default now()
);
create unique index on public.play_interest (user_id, play_id);
create index on public.play_interest (play_id, city);
create index on public.play_interest (play_id, city, created_at);

alter table public.play_interest enable row level security;
create policy "Users manage their own play interest"
  on public.play_interest for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Aggregate counts (never exposes user IDs)
create view public.play_waiting_counts as
  select play_id, city, count(*)::int as waiting
  from public.play_interest group by play_id, city;
grant select on public.play_waiting_counts to anon, authenticated;

-- 8-bucket monthly sparkline
create view public.play_waiting_trend as
  select play_id, city,
    to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
    count(*)::int as count
  from public.play_interest
  group by play_id, city, date_trunc('month', created_at);
grant select on public.play_waiting_trend to anon, authenticated;

-- Cross-production emotion aggregate (seeded empty; trigger populated in F34)
create table public.play_emotion_counts (
  play_id uuid not null references public.plays(id) on delete cascade,
  emotion text not null,
  weight  numeric not null default 0,
  primary key (play_id, emotion)
);
alter table public.play_emotion_counts enable row level security;
create policy "Anyone can read play emotion counts"
  on public.play_emotion_counts for select using (true);
grant select on public.play_emotion_counts to authenticated;

create view public.play_spectrum as
  select play_id, emotion,
    round(100 * weight / nullif(sum(weight) over (partition by play_id), 0))::int as pct
  from public.play_emotion_counts;
grant select on public.play_spectrum to authenticated;

-- New nullable columns on plays
alter table public.plays add column if not exists premise text;
alter table public.plays add column if not exists read_prompt text;
alter table public.plays add column if not exists library_url text;
alter table public.plays add column if not exists adjacent_event_id uuid
  references public.events(id) on delete set null;

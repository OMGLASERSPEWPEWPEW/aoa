-- Phase 0, Node: schema-emotion-agg
-- Event and profile emotion aggregate tables + maintenance triggers + spectrum view

create table public.event_emotion_counts (
  event_id uuid not null references public.events(id) on delete cascade,
  emotion text not null,
  weight numeric not null default 0,
  primary key (event_id, emotion)
);

alter table public.event_emotion_counts enable row level security;

create policy "Anyone can read event emotion counts"
  on public.event_emotion_counts for select
  using (true);

create view public.event_spectrum as
select event_id,
       emotion,
       round(100.0 * weight / nullif(sum(weight) over (partition by event_id), 0)) as pct
from public.event_emotion_counts;

create table public.profile_emotion_counts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  emotion text not null,
  weight numeric not null default 0,
  season text not null, -- e.g. '2025' means Sep 2025 - Aug 2026
  primary key (user_id, emotion, season)
);

alter table public.profile_emotion_counts enable row level security;

create policy "Anyone can read profile emotion counts"
  on public.profile_emotion_counts for select
  using (true);

-- Helper: compute season key from a date (Sep 1 - Aug 31)
create or replace function public.season_key(d date)
returns text
language sql immutable
as $$
  select case
    when extract(month from d) >= 9 then extract(year from d)::text
    else (extract(year from d) - 1)::text
  end;
$$;

-- Trigger: maintain event_emotion_counts on watchlist insert/update
create or replace function public.update_event_emotion_counts()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  slug text;
  pick_weight numeric;
begin
  -- Remove old contributions from this user for this event
  if TG_OP = 'UPDATE' and old.emotions is not null and cardinality(old.emotions) > 0 then
    declare
      old_weight numeric := 1.0 / cardinality(old.emotions);
    begin
      foreach slug in array old.emotions loop
        update public.event_emotion_counts
        set weight = greatest(weight - old_weight, 0)
        where event_id = old.event_id and emotion = slug;
      end loop;
      -- Clean up zero-weight rows
      delete from public.event_emotion_counts
      where event_id = old.event_id and weight <= 0;
    end;
  end if;

  -- Add new contributions
  if new.emotions is not null and cardinality(new.emotions) > 0 then
    pick_weight := 1.0 / cardinality(new.emotions);
    foreach slug in array new.emotions loop
      insert into public.event_emotion_counts (event_id, emotion, weight)
      values (new.event_id, slug, pick_weight)
      on conflict (event_id, emotion)
      do update set weight = public.event_emotion_counts.weight + excluded.weight;
    end loop;
  end if;

  return new;
end;
$$;

create trigger on_watchlist_emotions_change
  after insert or update of emotions on public.watchlist
  for each row execute function public.update_event_emotion_counts();

-- Trigger: maintain profile_emotion_counts on watchlist insert/update
create or replace function public.update_profile_emotion_counts()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  slug text;
  pick_weight numeric;
  s text;
begin
  s := public.season_key(coalesce(new.seen_date, current_date));

  -- Remove old contributions
  if TG_OP = 'UPDATE' and old.emotions is not null and cardinality(old.emotions) > 0 then
    declare
      old_weight numeric := 1.0 / cardinality(old.emotions);
      old_season text := public.season_key(coalesce(old.seen_date, current_date));
    begin
      foreach slug in array old.emotions loop
        update public.profile_emotion_counts
        set weight = greatest(weight - old_weight, 0)
        where user_id = old.user_id and emotion = slug and season = old_season;
      end loop;
      delete from public.profile_emotion_counts
      where user_id = old.user_id and season = old_season and weight <= 0;
    end;
  end if;

  -- Add new contributions
  if new.emotions is not null and cardinality(new.emotions) > 0 then
    pick_weight := 1.0 / cardinality(new.emotions);
    foreach slug in array new.emotions loop
      insert into public.profile_emotion_counts (user_id, emotion, weight, season)
      values (new.user_id, slug, pick_weight, s)
      on conflict (user_id, emotion, season)
      do update set weight = public.profile_emotion_counts.weight + excluded.weight;
    end loop;
  end if;

  return new;
end;
$$;

create trigger on_watchlist_profile_emotions
  after insert or update of emotions on public.watchlist
  for each row execute function public.update_profile_emotion_counts();

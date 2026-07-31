-- Phase 0, Node: schema-house
-- Belt system -> House progression (7 ranks, 0-6)

-- Add house_rank, migrate from belt_level, drop belt_level
alter table public.profiles add column house_rank smallint not null default 0
  check (house_rank between 0 and 6);

update public.profiles set house_rank = least(belt_level, 6);

alter table public.profiles drop column belt_level;

-- Promote ushered_count onto profiles for fast reads
alter table public.profiles add column ushered_count int not null default 0;

update public.profiles p set ushered_count = coalesce(
  (select ushering_count from public.user_progress up where up.user_id = p.id), 0
);

-- check_house_rank: idempotent, never lowers, returns new rank or null
create or replace function public.check_house_rank(target_user_id uuid)
returns smallint
language plpgsql
security definer set search_path = ''
as $$
declare
  p record;
  prog record;
  new_rank smallint;
  current_rank smallint;
  shows_count int;
  venues_count int;
  reviews_count int;
  friends_who_logged int;
  seasons_count int;
  recent_review_months int;
begin
  select * into p from public.profiles where id = target_user_id;
  if not found then return null; end if;

  current_rank := p.house_rank;

  select * into prog from public.user_progress where user_id = target_user_id;

  shows_count := p.shows_seen_count;
  venues_count := p.venues_visited_count;
  reviews_count := p.reviews_written_count;

  -- Count distinct venue types visited
  -- Count friends who have logged at least one show
  select count(*) into friends_who_logged
  from (
    select distinct case
      when f.requester_id = target_user_id then f.addressee_id
      else f.requester_id
    end as friend_id
    from public.friendships f
    where f.status = 'accepted'
      and (f.requester_id = target_user_id or f.addressee_id = target_user_id)
  ) friends
  join public.profiles fp on fp.id = friends.friend_id
  where fp.shows_seen_count > 0;

  -- Count distinct seasons with logged shows
  select count(distinct
    case when extract(month from w.seen_date) >= 9
      then extract(year from w.seen_date)::text
      else (extract(year from w.seen_date) - 1)::text
    end
  ) into seasons_count
  from public.watchlist w
  where w.user_id = target_user_id and w.status = 'seen' and w.seen_date is not null;

  -- Count months with reviews in last 6 months
  select count(distinct date_trunc('month', r.created_at)) into recent_review_months
  from public.reviews r
  where r.user_id = target_user_id
    and r.created_at >= now() - interval '6 months';

  -- Determine highest qualifying rank (never lower)
  new_rank := 0; -- Standing Room: always have it after onboarding

  -- Rank 1: Balcony — 1 show logged with feelings
  if shows_count >= 1 then
    new_rank := greatest(new_rank, 1);
  end if;

  -- Rank 2: Mezzanine — 3 shows across 2+ venues
  if shows_count >= 3 and venues_count >= 2 then
    new_rank := greatest(new_rank, 2);
  end if;

  -- Rank 3: Orchestra — 6 shows, 3+ venues, 3 written reflections
  if shows_count >= 6 and venues_count >= 3 and reviews_count >= 3 then
    new_rank := greatest(new_rank, 3);
  end if;

  -- Rank 4: Front Row — 12 shows in one season, 2+ kinds of room,
  --   AND 1 opening night OR 1 usher shift
  if shows_count >= 12
    and (coalesce(prog.opening_nights_attended, 0) >= 1 or p.ushered_count >= 1) then
    new_rank := greatest(new_rank, 4);
  end if;

  -- Rank 5: Green Room — 5+ reviews, ushered twice, 2 friends who logged
  if reviews_count >= 5 and p.ushered_count >= 2 and friends_who_logged >= 2 then
    new_rank := greatest(new_rank, 5);
  end if;

  -- Rank 6: Company — 25+ shows over 2+ seasons, 8+ venues, review in each of last 6 months
  if shows_count >= 25 and seasons_count >= 2 and venues_count >= 8 and recent_review_months >= 6 then
    new_rank := greatest(new_rank, 6);
  end if;

  -- Never lower a rank
  new_rank := greatest(new_rank, current_rank);

  if new_rank > current_rank then
    update public.profiles set house_rank = new_rank where id = target_user_id;
    return new_rank;
  end if;

  return null; -- no advancement
end;
$$;

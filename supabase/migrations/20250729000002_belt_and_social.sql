create table public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles on delete cascade not null,
  genres_explored text[] default '{}',
  venues_visited uuid[] default '{}',
  learning_modules_completed text[] default '{}',
  friends_invited int default 0,
  opening_nights_attended int default 0,
  ushering_count int default 0,
  belt_history jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_progress enable row level security;

create policy "Users can read own progress"
  on public.user_progress for select
  using (auth.uid() = user_id);

create policy "Users can update own progress"
  on public.user_progress for update
  using (auth.uid() = user_id);

create policy "Users can insert own progress"
  on public.user_progress for insert
  with check (auth.uid() = user_id);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles on delete cascade not null,
  addressee_id uuid references public.profiles on delete cascade not null,
  status text not null check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now(),
  unique (requester_id, addressee_id)
);

alter table public.friendships enable row level security;

create policy "Users can read own friendships"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can request friendships"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

create policy "Users can update friendships they're part of"
  on public.friendships for update
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create or replace function public.increment_shows_seen()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.status = 'seen' and (old.status is null or old.status != 'seen') then
    update public.profiles
    set shows_seen_count = shows_seen_count + 1
    where id = new.user_id;
  end if;
  if old.status = 'seen' and new.status != 'seen' then
    update public.profiles
    set shows_seen_count = greatest(shows_seen_count - 1, 0)
    where id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger on_watchlist_status_change
  after insert or update of status on public.watchlist
  for each row execute function public.increment_shows_seen();

create or replace function public.increment_reviews_count()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.profiles
  set reviews_written_count = reviews_written_count + 1
  where id = new.user_id;
  return new;
end;
$$;

create trigger on_review_created
  after insert on public.reviews
  for each row execute function public.increment_reviews_count();

create or replace function public.update_community_rating()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.events
  set community_rating = (
    select avg(rating)::float4 from public.reviews where event_id = new.event_id
  ),
  rating_count = (
    select count(*) from public.reviews where event_id = new.event_id
  )
  where id = new.event_id;
  return new;
end;
$$;

create trigger on_review_rating_change
  after insert or update of rating or delete on public.reviews
  for each row execute function public.update_community_rating();

create or replace function public.create_user_progress()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.user_progress (user_id, belt_history)
  values (new.id, jsonb_build_array(jsonb_build_object('belt', 0, 'earned_at', now())));
  return new;
end;
$$;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.create_user_progress();

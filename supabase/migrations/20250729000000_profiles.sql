create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique,
  age_range text check (age_range in ('20s', '30s', '40s', '50s+')),
  home_city text default 'chicago',
  experience_level text check (experience_level in ('never', 'few', 'regular', 'professional')),
  interests text[] default '{}',
  belt_level int default 0 check (belt_level between 0 and 7),
  shows_seen_count int default 0,
  venues_visited_count int default 0,
  reviews_written_count int default 0,
  onboarding_complete boolean default false,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Anyone can read profiles"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

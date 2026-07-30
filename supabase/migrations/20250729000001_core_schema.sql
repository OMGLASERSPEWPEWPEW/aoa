create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  venue_type text check (venue_type in ('storefront', 'institutional', 'experimental', 'school')),
  address text,
  neighborhood text,
  city text default 'chicago',
  latitude float8,
  longitude float8,
  price_range text check (price_range in ('$', '$$', '$$$')),
  website_url text,
  photo_url text,
  genre_tags text[] default '{}',
  accessibility_info text,
  created_at timestamptz default now()
);

alter table public.venues enable row level security;

create policy "Anyone can read venues"
  on public.venues for select
  using (true);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues on delete cascade,
  title text not null,
  slug text unique not null,
  description text,
  event_type text check (event_type in ('show', 'class', 'workshop', 'festival', 'open-call')),
  genre_tags text[] default '{}',
  start_date date,
  end_date date,
  show_times jsonb,
  price_min int,
  price_max int,
  ticket_url text,
  hottix_available boolean default false,
  photo_url text,
  community_rating float4,
  rating_count int default 0,
  created_at timestamptz default now()
);

alter table public.events enable row level security;

create policy "Anyone can read events"
  on public.events for select
  using (true);

create table public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade not null,
  event_id uuid references public.events on delete cascade not null,
  status text not null check (status in ('want_to_see', 'seeing', 'seen')),
  rating int check (rating between 1 and 5),
  reflection text,
  seen_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, event_id)
);

alter table public.watchlist enable row level security;

create policy "Users can read own watchlist"
  on public.watchlist for select
  using (auth.uid() = user_id);

create policy "Users can insert own watchlist"
  on public.watchlist for insert
  with check (auth.uid() = user_id);

create policy "Users can update own watchlist"
  on public.watchlist for update
  using (auth.uid() = user_id);

create policy "Users can delete own watchlist"
  on public.watchlist for delete
  using (auth.uid() = user_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade not null,
  event_id uuid references public.events on delete cascade not null,
  rating int not null check (rating between 1 and 5),
  title text,
  body text,
  contains_spoilers boolean default false,
  helpful_count int default 0,
  created_at timestamptz default now(),
  unique (user_id, event_id)
);

alter table public.reviews enable row level security;

create policy "Anyone can read reviews"
  on public.reviews for select
  using (true);

create policy "Users can insert own reviews"
  on public.reviews for insert
  with check (auth.uid() = user_id);

create policy "Users can update own reviews"
  on public.reviews for update
  using (auth.uid() = user_id);

create policy "Users can delete own reviews"
  on public.reviews for delete
  using (auth.uid() = user_id);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade not null,
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.conversations enable row level security;

create policy "Users can crud own conversations"
  on public.conversations for all
  using (auth.uid() = user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

create policy "Users can crud own messages"
  on public.messages for all
  using (
    conversation_id in (
      select id from public.conversations where user_id = auth.uid()
    )
  );

create table public.learning_content (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  body text,
  category text check (category in ('venue', 'playwright', 'genre', 'guide', 'history')),
  belt_requirement int default 0,
  related_venue_ids uuid[] default '{}',
  photo_url text,
  created_at timestamptz default now()
);

alter table public.learning_content enable row level security;

create policy "Anyone can read learning content"
  on public.learning_content for select
  using (true);

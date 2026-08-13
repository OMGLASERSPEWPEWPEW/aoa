-- calls: weekly mentor call (one per user per week)
create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  week_of date not null,
  reason text not null,
  status text not null default 'open' check (status in ('open','declined','accepted','expired')),
  created_at timestamptz not null default now()
);
create unique index if not exists calls_user_week on calls (user_id, week_of);

-- standing calls: recurring usher/PWYC/free nights
create table if not exists standing_calls (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  kind text not null check (kind in ('usher','pwyc','student_rush','free')),
  recurrence text,
  slots int,
  signup_url text,
  active boolean not null default true
);

-- learn cards: optional inline learning (never gated, never scored)
create table if not exists learn_cards (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  dek text not null,
  body_md text not null,
  seconds int not null default 90,
  tags text[] not null default '{}'
);

-- plans: going together
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  performance_at timestamptz not null,
  seats_total int not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists plan_members (
  plan_id uuid not null references plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited','in','paid','out')),
  seat_note text,
  primary key (plan_id, user_id)
);

create table if not exists plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  at_label text not null,
  body text not null,
  detail text,
  sort_order int not null
);

create table if not exists plan_messages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- threads: production-scoped conversations
create table if not exists threads (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists threads_event on threads (event_id);

create table if not exists thread_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  contains_spoilers boolean not null default false,
  created_at timestamptz not null default now()
);

-- notifications
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'play_announced','artist_cast','open_seat','plan_reminder',
    'call_ready','on_sale','rank_up','friend_activity')),
  subject_type text not null,
  subject_id uuid not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created on notifications (user_id, created_at desc);

-- RLS for all new tables
alter table calls enable row level security;
alter table standing_calls enable row level security;
alter table learn_cards enable row level security;
alter table plans enable row level security;
alter table plan_members enable row level security;
alter table plan_items enable row level security;
alter table plan_messages enable row level security;
alter table threads enable row level security;
alter table thread_posts enable row level security;
alter table notifications enable row level security;

-- Calls: user-owned
create policy "Users read own calls" on calls for select using (auth.uid() = user_id);
create policy "Users update own calls" on calls for update using (auth.uid() = user_id);

-- Standing calls: publicly readable
create policy "Standing calls are public" on standing_calls for select using (true);

-- Learn cards: publicly readable
create policy "Learn cards are public" on learn_cards for select using (true);

-- Plans: members can read
create policy "Plan creators can manage" on plans for all using (auth.uid() = creator_id);
create policy "Plan members can read plans" on plan_members for select using (auth.uid() = user_id);
create policy "Users can join plans" on plan_members for insert with check (auth.uid() = user_id);
create policy "Users can update own membership" on plan_members for update using (auth.uid() = user_id);

-- Plan items: readable by plan members
create policy "Plan items are public" on plan_items for select using (true);

-- Plan messages: members can read and write
create policy "Plan messages readable" on plan_messages for select using (auth.uid() = user_id);
create policy "Plan messages writable" on plan_messages for insert with check (auth.uid() = user_id);

-- Threads: public read
create policy "Threads are public" on threads for select using (true);

-- Thread posts: must have seen the show to post
create policy "Thread posts readable" on thread_posts for select using (true);
create policy "Thread posts writable by viewers" on thread_posts for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from threads t
      join watchlist w on w.event_id = t.event_id
      where t.id = thread_id
        and w.user_id = auth.uid()
        and w.status = 'seen'
    )
  );

-- Notifications: user-owned
create policy "Users read own notifications" on notifications for select using (auth.uid() = user_id);
create policy "Users update own notifications" on notifications for update using (auth.uid() = user_id);

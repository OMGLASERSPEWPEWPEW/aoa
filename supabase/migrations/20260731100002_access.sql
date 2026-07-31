-- Phase 0, Node: schema-access
-- Venue access fields + event_access table (the product promise)

alter table public.venues add column pay_what_you_can_days text[] not null default '{}';
alter table public.venues add column student_rush_price numeric;
alter table public.venues add column seat_count int;
alter table public.venues add column usher_signup_url text;

create table public.event_access (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  asl_dates date[] not null default '{}',
  relaxed_dates date[] not null default '{}',
  audio_described_dates date[] not null default '{}',
  open_caption_dates date[] not null default '{}',
  touch_tour_dates date[] not null default '{}',
  usher_slots int not null default 0,
  runtime_minutes int,
  has_intermission boolean,
  content_notes text,
  created_at timestamptz not null default now()
);

create unique index idx_event_access_event_id on public.event_access (event_id);

alter table public.event_access enable row level security;

create policy "Anyone can read event access"
  on public.event_access for select
  using (true);

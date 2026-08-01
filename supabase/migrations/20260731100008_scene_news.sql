-- Phase 8, Node: scene-news
-- Editorial news items for the Discover page

create table public.scene_news (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('season_drop', 'free', 'closing_soon')),
  kicker text not null,
  headline text not null,
  dek text,
  link_event_id uuid references public.events(id) on delete set null,
  active boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.scene_news enable row level security;

create policy "Anyone can read active scene news"
  on public.scene_news for select
  using (active = true);

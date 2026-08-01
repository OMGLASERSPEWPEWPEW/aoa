create table if not exists public.diagnostics (
  id uuid default gen_random_uuid() primary key,
  sync_key text not null,
  session_id text not null,
  app text not null,
  timestamp bigint not null,
  level text not null,
  category text not null,
  message text not null,
  data jsonb,
  app_version text not null,
  created_at timestamptz default now()
);

create index if not exists idx_diagnostics_sync_key_ts on public.diagnostics (sync_key, timestamp desc);
create index if not exists idx_diagnostics_session on public.diagnostics (session_id);

alter table public.diagnostics enable row level security;

create policy "Allow anon insert" on public.diagnostics for insert with check (true);
create policy "Allow anon select" on public.diagnostics for select using (true);

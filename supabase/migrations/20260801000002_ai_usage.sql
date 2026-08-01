create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  model text not null,
  provider text not null,
  modality text not null default 'text',
  feature text,
  input_tokens int default 0,
  output_tokens int default 0,
  estimated_cost_usd numeric(10,6) default 0,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_ai_usage_user_id on public.ai_usage(user_id);
create index if not exists idx_ai_usage_feature on public.ai_usage(feature);
create index if not exists idx_ai_usage_created_at on public.ai_usage(created_at desc);

alter table public.ai_usage enable row level security;

create policy "Users can view own usage"
  on public.ai_usage for select to authenticated
  using (user_id = auth.uid());

create policy "Authenticated can insert usage"
  on public.ai_usage for insert to authenticated
  with check (true);

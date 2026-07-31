-- Phase 0, Node: schema-emotions
-- Canonical emotion slugs lookup table + validation function
-- Triggers are attached in 20260731100003 when emotions columns are added

create table public.emotion_slugs (
  slug text primary key
);

insert into public.emotion_slugs (slug) values
  ('delighted'),
  ('electrified'),
  ('furious'),
  ('gutted'),
  ('aching'),
  ('cracked_open'),
  ('unsettled'),
  ('transported'),
  ('seen'),
  ('held'),
  ('buzzing'),
  ('bored');

alter table public.emotion_slugs enable row level security;

create policy "Anyone can read emotion slugs"
  on public.emotion_slugs for select
  using (true);

create or replace function public.validate_emotions()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  slug text;
begin
  foreach slug in array new.emotions loop
    if not exists (select 1 from public.emotion_slugs where public.emotion_slugs.slug = validate_emotions.slug) then
      raise exception 'Invalid emotion slug: %', slug;
    end if;
  end loop;
  return new;
end;
$$;

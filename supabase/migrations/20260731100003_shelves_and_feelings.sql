-- Phase 0, Node: schema-shelves
-- Three shelves (want_to_see / booked / seen), emotions replace stars

-- Shelf rename: seeing -> booked
alter table public.watchlist drop constraint watchlist_status_check;
update public.watchlist set status = 'booked' where status = 'seeing';
alter table public.watchlist add constraint watchlist_status_check
  check (status in ('want_to_see', 'booked', 'seen'));

-- Feelings replace stars on watchlist
alter table public.watchlist add column emotions text[] not null default '{}';
alter table public.watchlist add column room_volume text
  check (room_volume in ('murmur', 'applause', 'standing'));
alter table public.watchlist add constraint watchlist_emotions_len
  check (cardinality(emotions) <= 3);

-- Booking details
alter table public.watchlist add column performance_at timestamptz;
alter table public.watchlist add column seat_note text;

-- Drop star rating from watchlist
alter table public.watchlist drop column rating;

-- Feelings replace stars on reviews
alter table public.reviews add column emotions text[] not null default '{}';
alter table public.reviews add column prompt text;
alter table public.reviews add constraint reviews_emotions_len
  check (cardinality(emotions) between 1 and 3);

-- Drop the trigger that computed community_rating from stars (must go before dropping rating column)
drop trigger if exists on_review_rating_change on public.reviews;
drop function if exists public.update_community_rating();

-- Drop star rating from reviews
alter table public.reviews drop column rating;

-- Drop community_rating from events (derived from stars, no longer relevant)
alter table public.events drop column community_rating;
alter table public.events drop column rating_count;

-- Attach emotion validation triggers (function created in 20260731100000)
create trigger validate_watchlist_emotions
  before insert or update of emotions on public.watchlist
  for each row execute function public.validate_emotions();

create trigger validate_review_emotions
  before insert or update of emotions on public.reviews
  for each row execute function public.validate_emotions();

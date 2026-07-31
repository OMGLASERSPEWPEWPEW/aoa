-- Auto-track unique venues visited when a show is marked "seen"
create or replace function public.track_venue_visited()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_venue_id uuid;
begin
  if new.status = 'seen' and (old.status is null or old.status != 'seen') then
    select venue_id into v_venue_id
    from public.events
    where id = new.event_id;

    if v_venue_id is not null then
      update public.user_progress
      set venues_visited = array(
        select distinct unnest(
          array_append(venues_visited, v_venue_id)
        )
      ),
      updated_at = now()
      where user_id = new.user_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger on_watchlist_track_venue
  after insert or update of status on public.watchlist
  for each row execute function public.track_venue_visited();

-- RPC to increment helpful count on a review
create or replace function public.increment_helpful_count(review_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.reviews
  set helpful_count = helpful_count + 1
  where id = review_id;
end;
$$;

-- Phase 0, Node: schema-tonight
-- is_up_tonight() function for determining which events have performances today

create or replace function public.is_up_tonight(e public.events, at timestamptz default now())
returns boolean
language sql stable
as $$
  select case
    -- No show_times data: can't determine
    when e.show_times is null then false
    -- Check exceptions first (dark days override regular schedule)
    when e.show_times->'exceptions' ? to_char(at at time zone 'America/Chicago', 'YYYY-MM-DD')
      then jsonb_array_length(
        e.show_times->'exceptions'->to_char(at at time zone 'America/Chicago', 'YYYY-MM-DD')
      ) > 0
    -- Check regular schedule for today's day of week
    else jsonb_array_length(
      coalesce(
        e.show_times->lower(to_char(at at time zone 'America/Chicago', 'Dy')),
        '[]'::jsonb
      )
    ) > 0
  end
  -- Also must be within the run dates
  and (e.start_date is null or (at at time zone 'America/Chicago')::date >= e.start_date)
  and (e.end_date is null or (at at time zone 'America/Chicago')::date <= e.end_date);
$$;

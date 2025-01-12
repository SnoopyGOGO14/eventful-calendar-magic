-- Function to get events between two dates
create or replace function get_events_between_dates(
  start_date text,
  end_date text
)
returns setof events
language sql
stable
as $$
  select *
  from events
  where date >= start_date
  and date <= end_date
  order by date asc;
$$;

-- Function to get events by status
create or replace function get_events_by_status(
  event_status text
)
returns setof events
language sql
stable
as $$
  select *
  from events
  where status = event_status
  order by date asc;
$$;

-- Function to get upcoming events
create or replace function get_upcoming_events(
  days_ahead integer default 30
)
returns setof events
language sql
stable
as $$
  select *
  from events
  where date >= current_date::text
  and date <= (current_date + days_ahead)::text
  order by date asc;
$$;

-- Function to get events by promoter
create or replace function get_events_by_promoter(
  promoter_name text
)
returns setof events
language sql
stable
as $$
  select *
  from events
  where promoter ilike '%' || promoter_name || '%'
  order by date asc;
$$;

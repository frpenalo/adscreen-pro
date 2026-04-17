-- Add metadata JSONB to ads (style, category, prompt, objective)
alter table ads add column if not exists metadata jsonb default '{}'::jsonb;

-- Enrich ad_logs with time context (populated by trigger on insert)
alter table ad_logs
  add column if not exists hour_of_day smallint,
  add column if not exists day_of_week smallint;

-- Trigger to auto-fill hour/day on insert
create or replace function fill_ad_log_time()
returns trigger language plpgsql as $$
begin
  new.hour_of_day := extract(hour from new.created_at at time zone 'America/New_York')::smallint;
  new.day_of_week := extract(dow  from new.created_at at time zone 'America/New_York')::smallint;
  return new;
end;
$$;

drop trigger if exists ad_log_time_trigger on ad_logs;
create trigger ad_log_time_trigger
  before insert on ad_logs
  for each row execute function fill_ad_log_time();

-- Indexes for analytics queries
create index if not exists ad_logs_hour_idx on ad_logs(hour_of_day);
create index if not exists ad_logs_dow_idx  on ad_logs(day_of_week);
create index if not exists ads_metadata_idx on ads using gin(metadata);

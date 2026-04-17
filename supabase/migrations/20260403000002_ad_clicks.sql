-- Add website_url to advertisers
alter table advertisers add column if not exists website_url text;

-- QR scan tracking table
create table if not exists ad_clicks (
  id           uuid primary key default gen_random_uuid(),
  ad_id        uuid not null references ads(id) on delete cascade,
  screen_id    text not null,
  hour_of_day  smallint,
  day_of_week  smallint,
  created_at   timestamptz not null default now()
);

-- Trigger to auto-fill hour/day
create or replace function fill_ad_click_time()
returns trigger language plpgsql as $$
begin
  new.hour_of_day := extract(hour from new.created_at at time zone 'America/New_York')::smallint;
  new.day_of_week := extract(dow  from new.created_at at time zone 'America/New_York')::smallint;
  return new;
end;
$$;

drop trigger if exists ad_click_time_trigger on ad_clicks;
create trigger ad_click_time_trigger
  before insert on ad_clicks
  for each row execute function fill_ad_click_time();

create index if not exists ad_clicks_ad_id_idx    on ad_clicks(ad_id);
create index if not exists ad_clicks_created_idx  on ad_clicks(created_at);

alter table ad_clicks enable row level security;

-- Anyone can insert (redirect page is public)
create policy "public can insert clicks"
  on ad_clicks for insert
  with check (true);

-- Advertiser sees own ad clicks
create policy "advertiser sees own clicks"
  on ad_clicks for select
  using (
    ad_id in (select id from ads where advertiser_id = auth.uid())
  );

create policy "admin sees all clicks"
  on ad_clicks for select
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

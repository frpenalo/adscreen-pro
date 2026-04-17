-- Proof of Play: log each ad impression
create table if not exists ad_logs (
  id          uuid primary key default gen_random_uuid(),
  ad_id       uuid not null references ads(id) on delete cascade,
  location_id text not null, -- screenId from the player URL
  created_at  timestamptz not null default now()
);

-- Index for fast queries by ad and by date
create index if not exists ad_logs_ad_id_idx      on ad_logs(ad_id);
create index if not exists ad_logs_created_at_idx on ad_logs(created_at);
create index if not exists ad_logs_location_idx   on ad_logs(location_id);

-- Anyone can insert (player runs unauthenticated), only owner can read
alter table ad_logs enable row level security;

create policy "player can insert impressions"
  on ad_logs for insert
  with check (true);

create policy "advertiser sees own ad logs"
  on ad_logs for select
  using (
    ad_id in (
      select id from ads where advertiser_id = auth.uid()
    )
  );

create policy "admin sees all logs"
  on ad_logs for select
  using (
    exists (
      select 1 from profiles where id = auth.uid() and role = 'admin'
    )
  );

-- When each person was last using the app (heartbeat while a tab is open).
alter table public.profiles add column if not exists last_seen_at timestamptz;

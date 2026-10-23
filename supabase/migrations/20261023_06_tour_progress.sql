-- Remembers which guided tours each person has finished, so the tour shows
-- once per account (not once per browser). Server-only: RLS on, no policies.
create table if not exists public.tour_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  tour text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, tour)
);

alter table public.tour_progress enable row level security;

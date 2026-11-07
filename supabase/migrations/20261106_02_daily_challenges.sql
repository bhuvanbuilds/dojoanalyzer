-- One suggested LeetCode problem per student per day (IST). It completes on
-- its own when LeetCode shows it accepted that same day; nobody ticks it by
-- hand. Consecutive completed days make the daily streak.
-- Server-only: RLS on, no policies (the app reads and writes with the service key).

create table if not exists public.daily_challenges (
  student_id uuid not null references public.students (id) on delete cascade,
  day date not null,
  title_slug text not null,
  title text not null,
  difficulty text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  topic text,
  belt_level integer,
  language text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (student_id, day)
);

create index if not exists daily_challenges_open_idx on public.daily_challenges (student_id, day) where completed_at is null;

alter table public.daily_challenges enable row level security;

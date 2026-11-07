-- Each student's public coding and professional profiles, shown on their
-- profile and leaderboard cards. Imported from the SJU Google Form.
-- Server-only: RLS on, no policies (the app reads and writes with the service key).

create table if not exists public.student_links (
  student_id uuid primary key references public.students (id) on delete cascade,
  github_url text check (github_url is null or github_url ~ '^https://github\.com/[A-Za-z0-9-]+/?$'),
  linkedin_url text check (linkedin_url is null or linkedin_url ~ '^https://(www\.)?linkedin\.com/in/[^/?#\s]+/?$'),
  codechef_url text check (codechef_url is null or codechef_url ~ '^https://(www\.)?codechef\.com/users/[A-Za-z0-9_]+/?$'),
  updated_at timestamptz not null default now()
);

alter table public.student_links enable row level security;

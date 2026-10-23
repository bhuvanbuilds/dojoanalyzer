-- People who sign in without an account can ask for access; super admins and
-- developers approve or reject from the app. Additive only.
begin;

create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null check (char_length(full_name) between 2 and 120),
  requested_role text not null
    check (requested_role in ('student', 'mentor', 'campus_manager', 'other')),
  other_role text check (other_role is null or char_length(other_role) <= 80),
  university_id uuid references public.universities(id) on delete set null,
  university_name text check (university_name is null or char_length(university_name) <= 120),
  squad_number text check (squad_number is null or char_length(squad_number) <= 12),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One open request per person at a time.
create unique index if not exists access_requests_one_pending
  on public.access_requests (user_id) where status = 'pending';
create index if not exists access_requests_status_idx
  on public.access_requests (status, created_at desc);

alter table public.access_requests enable row level security;

commit;

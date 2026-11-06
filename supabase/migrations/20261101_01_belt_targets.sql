-- Monthly belt targets a mentor (or campus manager / super admin) sets for
-- students: either a total number of belts to gain this month, or a number
-- per language. One target per student per month; setting it again updates it.
-- Server-only: RLS on, no policies (the app reads and writes with the service key).
create table if not exists public.belt_targets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  -- First day of the target month.
  month date not null,
  -- Exactly one of these: a total, or per-language gains like {"java": 1, "python": 2}.
  total_gain integer check (total_gain is null or total_gain between 1 and 40),
  language_gains jsonb,
  note text check (note is null or char_length(note) <= 300),
  set_by uuid references auth.users (id) on delete set null,
  -- When the student first saw it in the app (for the one-time popup).
  seen_at timestamptz,
  emailed_at timestamptz,
  -- Developer test targets: never emailed, hidden from the student, and
  -- removable in one go from the Belt targets page.
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, month),
  check ((total_gain is null) <> (language_gains is null)),
  check (extract(day from month) = 1)
);

-- In case the table was created before is_test existed.
alter table public.belt_targets add column if not exists is_test boolean not null default false;

create index if not exists belt_targets_month_idx on public.belt_targets (month);
create index if not exists belt_targets_test_idx on public.belt_targets (is_test) where is_test;

alter table public.belt_targets enable row level security;

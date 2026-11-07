-- LeetCode tracker: each student's LeetCode account and the problems they
-- solve. Students set their own username; staff can set or bulk-import it.
-- Server-only: RLS on, no policies (the app reads and writes with the service key).

create table if not exists public.leetcode_accounts (
  student_id uuid primary key references public.students (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_-]{1,40}$'),
  avatar_url text,
  total_solved integer,
  easy_solved integer,
  medium_solved integer,
  hard_solved integer,
  -- LeetCode's own day streak and submission calendar ({"<unix day>": count}).
  streak integer,
  calendar jsonb,
  last_synced_at timestamptz,
  sync_error text,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One student per LeetCode account.
create unique index if not exists leetcode_accounts_username_idx on public.leetcode_accounts (lower(username));

-- First accepted solve of each problem. `counted` is false for problems that
-- were already solved before tracking began (or re-solves LeetCode didn't add
-- to the total), so only genuinely new problems count towards a day.
create table if not exists public.leetcode_solves (
  student_id uuid not null references public.students (id) on delete cascade,
  title_slug text not null,
  title text,
  solved_at timestamptz not null,
  counted boolean not null default true,
  primary key (student_id, title_slug)
);

create index if not exists leetcode_solves_day_idx on public.leetcode_solves (student_id, solved_at) where counted;

alter table public.leetcode_accounts enable row level security;
alter table public.leetcode_solves enable row level security;

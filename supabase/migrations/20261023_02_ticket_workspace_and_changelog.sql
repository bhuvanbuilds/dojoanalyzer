-- Ticket workspace and changelog. Additive only: new columns default to
-- empty values and a new table; nothing existing is changed or removed.
begin;

alter table public.support_tickets
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists resolved_at timestamptz;

create index if not exists support_tickets_assigned_idx
  on public.support_tickets (assigned_to, status);

-- Staff-only notes in a ticket thread; reporters never see them.
alter table public.support_messages
  add column if not exists is_internal boolean not null default false;

-- Release notes. A ticket (usually a fixed bug) can become an entry; only
-- published entries are shown on the What's new page.
create table if not exists public.changelog_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('fix', 'feature', 'improvement')),
  title text not null check (char_length(title) between 3 and 140),
  body text check (body is null or char_length(body) <= 2000),
  ticket_id uuid references public.support_tickets(id) on delete set null,
  published boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists changelog_entries_published_idx
  on public.changelog_entries (published, published_at desc);

alter table public.changelog_entries enable row level security;

commit;

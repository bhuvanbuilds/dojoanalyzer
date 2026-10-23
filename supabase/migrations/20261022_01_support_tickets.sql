-- Support tickets: feature suggestions, bug reports and other issues, each
-- with a conversation thread between the reporter and the support team.
-- RLS is on with no policies: only the server (service role) reads and
-- writes these tables, after checking who is asking.
begin;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  reporter_email text not null,
  reporter_name text,
  reporter_role text,
  university_id uuid references public.universities(id) on delete set null,
  type text not null check (type in ('feature', 'bug', 'other')),
  title text not null check (char_length(title) between 3 and 140),
  description text not null check (char_length(description) between 10 and 5000),
  severity text check (severity in ('low', 'medium', 'high')),
  page_url text,
  user_agent text,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_user_idx
  on public.support_tickets (user_id, created_at desc);
create index if not exists support_tickets_status_idx
  on public.support_tickets (status, updated_at desc);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name text,
  is_staff boolean not null default false,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists support_messages_ticket_idx
  on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

commit;

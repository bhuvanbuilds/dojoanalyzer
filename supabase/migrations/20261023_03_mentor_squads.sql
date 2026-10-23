-- Mentors look after specific squads, not a whole campus. Additive only.
begin;

create table if not exists public.mentor_squads (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  squad_id uuid not null references public.squads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, squad_id)
);

create index if not exists mentor_squads_squad_idx on public.mentor_squads (squad_id);

alter table public.mentor_squads enable row level security;

-- A signed-in mentor may read their own assignments (the profile loader
-- runs with their session); every write goes through the server.
drop policy if exists "mentor reads own squads" on public.mentor_squads;
create policy "mentor reads own squads" on public.mentor_squads
  for select using (profile_id = auth.uid());

-- Pending invitations remember the squads to hand over on first sign-in.
alter table public.user_invitations
  add column if not exists squad_ids uuid[] not null default '{}';

commit;

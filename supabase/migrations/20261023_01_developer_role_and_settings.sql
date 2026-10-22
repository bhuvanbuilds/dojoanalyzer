-- Adds the `developer` role (same powers as super admin, plus it stays in
-- the app during maintenance) and an app_settings table holding the
-- maintenance switch. Role rules are rebuilt as one complete set.
begin;

-- profiles: replace every role-related check with the full current rules.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname in ('profiles', 'user_invitations')
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ~* '\mrole\M'
  loop
    execute format(
      'alter table public.%I drop constraint %I',
      (select t.relname from pg_constraint c2 join pg_class t on t.oid = c2.conrelid
        where c2.conname = constraint_row.conname limit 1),
      constraint_row.conname
    );
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_allowed_check
  check (role in ('super_admin', 'developer', 'campus_manager', 'mentor', 'student'));
alter table public.profiles
  add constraint profiles_role_scope_check
  check (
    (role in ('super_admin', 'developer') and university_id is null and student_id is null) or
    (role in ('campus_manager', 'mentor') and university_id is not null and student_id is null) or
    (role = 'student' and student_id is not null)
  );

alter table public.user_invitations
  add constraint user_invitations_role_allowed_check
  check (role in ('super_admin', 'developer', 'campus_manager', 'mentor', 'student'));
alter table public.user_invitations
  add constraint user_invitations_role_scope_check
  check (
    (role in ('super_admin', 'developer') and university_id is null and student_id is null) or
    (role in ('campus_manager', 'mentor') and university_id is not null and student_id is null) or
    (role = 'student' and student_id is not null)
  );

-- Small key/value store for app-wide switches such as maintenance mode.
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;

commit;

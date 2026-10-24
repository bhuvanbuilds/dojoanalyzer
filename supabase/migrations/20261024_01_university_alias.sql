-- Short display name for each university (e.g. "KARE"); the full name stays.
alter table public.universities add column if not exists alias text;
create unique index if not exists universities_alias_key
  on public.universities (lower(alias)) where alias is not null;

-- Computed column for PostgREST: select "name:display_name" to show the alias
-- when there is one, the full name otherwise.
create or replace function public.display_name(u public.universities)
returns text language sql stable as $$ select coalesce(nullif(trim(u.alias), ''), u.name) $$;

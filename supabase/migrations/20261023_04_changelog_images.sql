-- Screenshots on release notes, served from a public "changelog" bucket.
alter table public.changelog_entries add column if not exists image_url text;
insert into storage.buckets (id, name, public)
values ('changelog', 'changelog', true)
on conflict (id) do update set public = true;

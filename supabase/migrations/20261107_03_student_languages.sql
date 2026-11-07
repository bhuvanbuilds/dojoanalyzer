-- Each student's primary and secondary coding language (from the SJU form).
-- Targets are set on these two belts, and the leaderboard can rank by them.
-- Values are the app's language keys; secondary is null when it would repeat primary.

alter table public.students
  add column if not exists primary_language text check (primary_language in ('cpp', 'java', 'nodejs', 'python')),
  add column if not exists secondary_language text check (secondary_language in ('cpp', 'java', 'nodejs', 'python')),
  add constraint students_languages_differ check (secondary_language is null or secondary_language <> primary_language);

-- Personal email per student (Kalvium email stays in students.email).
alter table public.students add column if not exists personal_email text check (personal_email is null or personal_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
alter table testing.students add column if not exists personal_email text check (personal_email is null or personal_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

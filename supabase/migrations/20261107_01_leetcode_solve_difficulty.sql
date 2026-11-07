-- Difficulty of each solved problem, for LeetCode leaderboard points
-- (Easy 10, Medium 25, Hard 50). Filled in by the sync from LeetCode.
alter table public.leetcode_solves
  add column if not exists difficulty text check (difficulty is null or difficulty in ('Easy', 'Medium', 'Hard'));

# Master prompt: design the Dojo Belt Analyzer tutorial

Copy everything below the line into ChatGPT.

---

You are a product designer and onboarding expert. Help me design an in-app tutorial for my web app, **Dojo Belt Analyzer**. When we're done, write a build prompt that I'll paste into Claude Code, my coding agent, which has the full codebase.

## How to run this session

1. **Interview me in rounds. Use your choice UI** (clickable options and multi-select chips) wherever you can, instead of open questions. Ask at most 3–4 questions per round. Always add a "Something else" option.
2. **Go in this order:**
   1. Tutorial style.
   2. Which roles get a tutorial.
   3. For each role, page by page: which components and options to include, and how deep to go.
   4. Wording and tone.
   5. Triggers and persistence.
   6. Visuals and motion.
3. **For every page, show me the component list below as a multi-select** ("Which of these should the tutorial cover?"). Then ask how deep: one line / short explanation / step-by-step with the user clicking.
4. After each role, show a short summary table of what I picked and let me edit it before moving on.
5. **At the end, output one final "Build prompt for Claude Code"** in a single code block. Requirements are under "Final output format".

## About the app

This is an internal tool for Kalvium campuses. Every Friday, students take Dojo belt tests in four languages: **C++, Java, Node.js and Python**. A campus manager uploads the results as a CSV. The app turns them into dashboards, leaderboards and progress history.

- Week numbers belong to an academic year.
- A belt earned is kept, even if the student misses a later test.
- "Stalled" means no new belt across their last 3 tests.
- Stack: Next.js 16 App Router, Supabase, Tailwind, motion/react, lucide icons. It supports light and dark mode, and phones.

## Roles

| Role | Sees |
|---|---|
| **Student** | Own profile and the leaderboards |
| **Mentor** | Only the squads assigned to them: dashboard, leaderboards, insights |
| **Campus manager** | Their whole campus. Uploads CSVs and manages squads, students and imports |
| **Super admin** | Every campus. Universities, users, access requests, audit logs, support tickets |
| **Developer** | Everything a super admin sees, plus the Developer console, View as, maintenance mode and writing the changelog |
| **Unassigned person** | Signed in but has no role yet: sees the Request access form |

## Full inventory of pages, components and options

`[data-tour="x"]` means the element already has that marker in the code, so the tutorial can point at it. Elements without a marker need one added.

### Global (every signed-in page)

- **Top navbar:** groups Dashboard `nav-dashboard`, Leaderboards `nav-leaderboards`, My profile `nav-me` (students only), Insights `nav-insights` (a menu), Students `nav-students` (a menu, managers only) and Admin `nav-admin` (a menu, super admin and developer only). Menu items and sub-tabs are marked `go-<path>`, for example `go-/weekly-comparison`.
- **Sub-tabs under the navbar** for the current group.
- **Upload CSV button** `upload`: campus managers and super admins, hidden on phones. On phones it lives in the mobile menu.
- **Theme toggle** `theme`: light or dark; the shortcut is the T key.
- **Account menu** `account`: Profile, What's new, Sign out.
- **Help button** `help`, bottom corner. Its menu: Suggest a feature, Report a bug, My tickets.
- **Banners:**
  - Maintenance banner: shown to developers while maintenance is on.
  - View as banner: shown while a developer is previewing another role, with an Exit button.
- **What's new popup:** shows newly published changelog entries once, with "Got it" and "See all updates".
- **Mobile menu:** the hamburger with every nav item.

### Upload CSV dialog (campus manager, super admin)

1. Choose the university. Super admins pick any university; campus managers are fixed to their own campus.
2. Choose the file: .csv, max 10 MB.
3. **Preview & Validate:**
   - Shows "CSV detected", the academic year, weeks, records, unique students, new students vs existing students, and memberships to add.
   - Validation errors are listed row by row. A file with errors can't be imported.
4. **Import:** progress shows "Importing…". The result shows students created, memberships created, already assigned, and errors.
5. "Manage squads" link and Close.

The same dialog has a roster mode, "Add Students from CSV", opened from the Students page.

### Dashboard `/` (mentor, campus manager, super admin, developer)

- **Header** `dash-header`: scope name (campus, mentor's squads or "All universities"), week number and dates, and "Last import X ago".
- **Headline** `dash-headline`: belts gained this week, plus "N students moved up since Week M" (or "First imported week").
- **Filters** `dash-filters`:
  - University (super admin and developer only): "All universities" or one campus.
  - Academic year.
  - Week (newest by default).
- **KPI tiles** `kpis`. Each tile shows a change arrow against last week and is clickable:
  - Students tested `kpi-tested`: coverage % bar.
  - Avg belts per student `kpi-avg`.
  - Moved up this week `kpi-moved`: mini bar chart of every week.
  - Total belts held `kpi-total`: split by language.
  - Not tested this week `kpi-untested`.
- **Chart carousel** `charts`:
  - Tabs `chart-tabs` (each tab is `chart-tab-<key>`), prev/next arrows `chart-arrows` and the ←/→ keys.
  - Per-chart controls `chart-controls` and a chart/table toggle `chart-view`.
  - The five charts:
    1. Progress over time `trend`: Metric (Avg belts / Total belts / Students tested %) and By (Overall / Language / Squad / University).
    2. Belt levels `levels`: language picker or All.
    3. Where the belts are `share`: share of belts, with small groups folded into "Other".
    4. Compare squads/groups `compare`: average belts per tested student by language. Super admins get a Compare toggle: Squads / Universities.
    5. Weekly movement `movement`: moved up / no change / first record / not tested. Has a Scope picker.
- **Progress between weeks** `range`:
  - Controls `range-controls`: presets Last week / Last 4 weeks / Whole year, plus From, To and Scope.
  - Totals `range-stats`: belts gained, students improved, avg gain, no change.
  - Gains by language `range-languages`.
  - Student list `range-list`: search, sort by Most gained or Least gained. Click a student to open their history.
- **Needs attention** `needs-attention`: students not tested, squads under half tested, stalled students. Each row links to the names.
- **Top movers** `top-movers`: most belts gained, with a "See all" link.
- **Squads (or universities) at a glance** `squad-table`: columns Students, Tested %, Avg belts, vs previous week, Strongest in. Super admins get a Universities/Squads toggle.
- **Platform panel:** super admin only, platform-wide stats.

### Leaderboards `/leaderboard` and `/leaderboard/language` (everyone)

- **Hero** `lb-hero`: title and subtitle. **Podium** `lb-podium`: top 3 with confetti. Click a student to open their profile.
- **Controls** `lb-controls`:
  - Language picker `lb-languages` (language board only): C++ / Java / Node.js / Python.
  - Scope chips `lb-scope`: Everyone / My campus / My squad.
  - Filters `lb-filters`: University, Squad, Week, and Search (name, campus or squad).
- **Stat strip** `lb-stats`.
- **Rankings** `lb-rankings`: #4 and below, with "Show more". Layout switch `lb-layout`: List / Belt cards (remembered).
- **"You" pill:** the student's own rank when they're below #3.

### My profile `/student` (student) and student profile `/student/[id]` (staff)

- **Stats** `student-stats`: overall rank, campus rank, squad rank, belts held, change since previous test.
- **Belts panel** `belts`: belt per language, with from→to when they moved up.
- **Progress panel** `progress`: weekly growth graph, weeks moved up, per-language progress.
- **Comparison** `student-compare`: against their squad average and against their campus average, per language.
- Staff also get the **student history dialog**: weekly log, edit student.

### Insights → Weekly comparison `/weekly-comparison` (staff)

- **Header:** Export CSV button.
- **Week pickers** `wc-weeks`: From, To, and a ⇄ swap button.
- **Filters** `wc-filters`: search students, University, Squad, Language.
- **Summary** `wc-summary`: share bar (improved / no change / missing data). Click a segment to filter. The "Moved up" ring shows the %.
- **Top climbers** `wc-climbers`.
- **Change in belts histogram** `wc-histogram`.
- **Every student table** `wc-table`, with "Show more".

### Insights → Analytics `/analytics` (staff)

- **Tabs** `an-tabs`: Monthly / Yearly.
- **Filters** `an-filters`: Year, Month (monthly only), University (super admin only), Squad, Language (monthly only). An "Updating" indicator shows while numbers load.
- **Summary sentence and improvement-rate ring** `an-summary`.
- **Stat tiles** `an-tiles`: Belts earned and others, clickable.
- **Calendar** `an-calendar`: Pick a month / Month by month.
- **By language** `an-languages`.
- **Trend panel** `an-trend`: Across the year / Monthly progress.

### Students → Squads `/students` (campus manager, super admin)

- **Actions** `st-actions`: New squad (dialog: university, squad number), Add student (dialog: full name, email, university, squad), Import CSV (roster mode of the upload dialog).
- **Stats** `st-stats`.
- **Squad cards** `st-squads`: click to filter; "Copy squad ID".
- **Toolbar** `st-toolbar`: search, university filter, sort (Name A–Z / Squad / Recently joined), Cards/List layout.
- **Student collection:** cards or list, "Open profile", **Edit student** dialog (name, email, squad), monitor view (tested this week or not).
- **Stalled students** `/students/stalled`: search, Squad, Week.

### Students → Imports `/imports` (campus manager, super admin)

- University picker (super admin), **filters** `im-filters` (search, Status: All / Imported / Failed, week).
- History table with pagination.
- **Import detail** `/imports/[id]`: import ID, uploaded date, week, rows, validation errors; tabs for Imported Student Records, Raw Import Rows and Validation Errors.

### Admin (super admin, developer)

- **Universities** `/universities`: list, rename (pencil / save / cancel), squads and campus team per university.
- **Users** `/users`:
  - **Access requests panel:** name, email, requested role and university, details.
  - Grant role (Student / Mentor / Campus Manager / Super Admin), university, squad chips for mentors, optional note, Approve or Reject. Each shows a busy state and sends an email.
  - **Users table:** search by name or email, filter by role, role dropdown with "Saving…", university, "Squads this mentor looks after", **Delete user** dialog ("This can't be undone").
- **Audit logs** `/audit-logs`: who changed what, and when.
- **Tickets** `/support/inbox`:
  - Filters: Status, Type, Severity, Assignee, search, refresh.
  - Ticket panel: live chat that refreshes every 3s, with avatars; internal notes; reporter, browser and page; Assignee / Status / Severity / Kind.
  - **"Add to changelog"** dialog.

### Developer only

- **Developer console** `/developer`:
  - Services health, Recent activity, Open tickets, Shortcuts.
  - **View as:** pick a role and university, or search for a student. Read-only and audited; any write returns 403. A banner shows with an Exit button.
- **Maintenance mode** `/settings/maintenance`:
  - On/off, "How long should the app be locked?" (duration or "back soon"), optional message.
  - Everyone except developers is redirected to the maintenance page, and API calls get 503.
- **Changelog editor** `/changelog`: kind (Fix / Feature / Improvement), title, details, screenshot, draft/publish, delete draft. Every entry gets a feedback button.

### Everyone

- **Support** `/support`: my tickets (search, filter by type), new ticket dialog ("How can we help?": type, title, details, severity), ticket conversation `/support/[id]`.
- **Profile** `/profile`: display name, email (copy), sign-in method, member since, last signed in, Appearance (theme), Session (sign out).
- **What's new** `/changelog` (reading view).
- **Login** `/login`: Google sign-in. **Request access** `/request-access`:
  - Full name, Your role (Student / Mentor / Campus manager / Other).
  - University ("My university isn't listed" lets them type it), Squad, details.
  - Sent state, plus a Sign out button.
- **Privacy policy** `/privacy`.

## Questions you must cover

- **Style.** One or a mix of:
  - A spotlight tour on the real UI.
  - Short animated cards (motion graphics, no real data).
  - A checklist ("Get started: 4 tasks").
  - A help-center page per role.
  - Short videos or GIFs.
- **Interaction.** Do people click the real buttons themselves, or press Next? Does the tutorial switch tabs and charts for them?
- **Depth per page:** skip / one line / short / full step-by-step.
- **The CSV flow:** do a real walkthrough of the upload dialog, or use a fake sample file?
- **Tone:** casual or formal. Indian-English friendly? Any Tamil or Tanglish touches?
- **When it shows:**
  - First login only (stored per account on the server: a `tour_progress` table already exists with `user_id`, `tour` and `completed_at`).
  - Per role.
  - When a role changes.
  - When a new feature ships.
- **Replay:** from the Help menu, a page-level "?" button, or both.
- **Skip behaviour:** skip all, skip this page, or remind later.
- **View as:** should developers see the viewed role's tutorial?
- **Mobile:** same tutorial or a simplified one? (Upload is in the mobile menu.)
- **Measuring it:** track which steps people finish or skip?

## Final output format

The final build prompt for Claude Code must:

1. Name the style or styles, and the trigger and persistence rules, including using the existing `tour_progress` table through a small authenticated API route.
2. List every role's tutorial as an ordered list of steps. Each step has:
   - the page path
   - the `data-tour` target, or "needs new marker: <describe element>"
   - an action (none / user clicks / auto-switch tab)
   - a title
   - final user-facing copy (1–3 sentences)
3. Say which steps auto-navigate and which wait for the user to click.
4. Include design notes: spotlight or cards, motion, dark mode, phone behaviour, keyboard (←/→/Esc), and accessibility.
5. Include the rules:
   - Skip any step whose element doesn't exist for that role.
   - Never block the app if the tutorial fails.
   - View as must stay read-only.
6. End with: "Commit with a plain message (no co-author line) and don't push until I say so."

Start now with round 1.

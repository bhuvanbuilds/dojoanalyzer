// Guided tutorial content: one ordered tour per role, plus a small optional
// checklist. Everything the tutorial shows (tour cards, Help articles and the
// checklist) reads from this file so the copy never drifts.
//
// Kept free of imports so tests can load it directly.

export type TutorialRole = "student" | "mentor" | "campus_manager" | "super_admin";

/** Stored in tour_progress.tour. Bump the version to offer a new tour. */
export const TOUR_IDS: Record<TutorialRole, string> = {
  student: "student-v1",
  mentor: "mentor-v1",
  campus_manager: "campus-manager-v1",
  super_admin: "super-admin-v1",
};

export const ALL_TOUR_IDS = Object.values(TOUR_IDS);

export type TutorialAction =
  /** Read and press Next. */
  | "none"
  /** Try the real control, then press Continue. Never auto-advances. */
  | "click"
  /** Consequential control: highlighted but click-guarded; explained only. */
  | "guarded"
  /** Opens the isolated CSV demo; nothing is uploaded. */
  | "csv-demo";

export type TutorialStep = {
  id: string;
  /** Route the step lives on. `[id]` matches any segment. */
  page: string;
  /** data-tour values; the first visible one is spotlighted. */
  target: string[];
  action: TutorialAction;
  title: string;
  body: string;
  /** Optional media for when real recordings exist. Never required. */
  media?: { src: string; alt: string; kind: "video" | "image" };
};

/** Friendly page names for "Go to page" and the Help articles. */
export const PAGE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/leaderboard": "Leaderboard",
  "/leaderboard/language": "Language leaderboard",
  "/student": "My profile",
  "/weekly-comparison": "Weekly comparison",
  "/analytics": "Analytics",
  "/students": "Students",
  "/students/stalled": "Stalled students",
  "/imports": "Imports",
  "/imports/[id]": "Import details",
  "/universities": "Universities",
  "/users": "Users",
  "/audit-logs": "Audit logs",
  "/support/inbox": "Tickets",
  "*": "Any page",
};

/** Pages that can't be opened directly; the user has to pick a record first. */
export const PAGE_HINTS: Record<string, string> = {
  "/imports/[id]": "Open any import from the Imports list to continue.",
};

export function pageMatches(page: string, pathname: string) {
  if (page === "*") return true;
  const clean = (value: string) => value.replace(/\/+$/, "") || "/";
  const pattern = clean(page)
    .split("/")
    .map((part) => (part === "[id]" ? "[^/]+" : part.replace(/[.*+?^${}()|\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${pattern}$`).test(clean(pathname));
}

const s = (
  id: string,
  page: string,
  target: string | string[],
  action: TutorialAction,
  title: string,
  body: string,
): TutorialStep => ({ id, page, target: Array.isArray(target) ? target : [target], action, title, body });

// ─── Shared closing steps (theme, help, account) ───────────────────────────────
const CLOSING: TutorialStep[] = [
  s("G3", "*", "theme", "click", "Make it comfortable", "Switch between light and dark themes whenever you prefer. Shortcut: press T."),
  s("G4", "*", "help", "click", "Help is always available", "Open Help to replay this tutorial, read short guides for each page, or contact support."),
  s("G5", "*", "account", "click", "Your account", "Use the account menu to open your profile, read What's new, or sign out."),
];

// ─── Student ───────────────────────────────────────────────────────────────────
const STUDENT: TutorialStep[] = [
  s("S1", "/leaderboard", "lb-hero", "none", "Welcome to the leaderboards", "See how belt progress compares across the leaderboard scopes available to you. Rankings reflect recorded Dojo belt results, not attendance."),
  s("S2", "/leaderboard", "lb-podium", "none", "The top three", "The podium highlights the three highest-ranked students in the current results. Select a student if you'd like to open their profile."),
  s("S4", "/leaderboard", "lb-scope", "click", "Change the scope", "Use the scope chips to switch between Everyone, My campus and My squad. Only the scopes available to you are shown."),
  s("S5", "/leaderboard", ["lb-you-rank", "css:#leaderboard-you"], "none", "Find your rank", "When you're outside the podium, the You indicator helps you find your own row. Your position depends on the selected scope and filters."),
  s("S3", "/leaderboard/language", "lb-languages", "click", "Explore each language", "Choose C++, Java, Node.js or Python to see language-specific rankings. The results follow the language you select."),
  s("S6", "/student", "student-stats", "none", "Your belt statistics", "Your overall, campus and squad ranks, the belts you hold, and your change since the previous test."),
  s("S7", "/student", "belts", "none", "Belts you've earned", "Your current belt in each language and any recent move up. An earned belt is kept even if you miss a later test."),
  s("S8", "/student", "progress", "none", "Follow your progress", "The weekly graph and language breakdown show how your results develop. Week numbers belong to an academic year, so compare within the same year."),
  s("S9", "/student", "student-compare", "none", "Compare your progress", "Where data is available, see how each language compares with your squad and campus averages. Use it as context for your own history."),
  ...CLOSING,
];

// ─── Mentor ────────────────────────────────────────────────────────────────────
const MENTOR: TutorialStep[] = [
  s("M1", "/", "dash-header", "none", "Your squads at a glance", "The dashboard is scoped to the squads assigned to you. Check the week, dates and latest import before reading the numbers."),
  s("M2", "/", "dash-headline", "none", "This week's movement", "Belts gained and students who moved up compared with the previous week. If this is the first imported week, there's nothing to compare against yet."),
  s("M3", "/", "dash-filters", "click", "Choose the academic period", "Change the academic year and week to look at another period. Week numbers always belong to an academic year."),
  s("M4", "/", "kpis", "click", "Read the key metrics", "The tiles show test coverage, average belts, weekly movement and total belts held. Click a tile to see the students behind it."),
  s("M5", "/", "needs-attention", "none", "Know where to follow up", "Students not tested, squads with low coverage, and stalled students. Stalled means no new belt across the last three tests."),
  s("M6", "/", "top-movers", "none", "Celebrate progress", "The students who gained the most belts since their previous test. Use the link to see more."),
  s("M7", "/", "charts", "click", "Explore the charts", "Use the tabs and controls to explore progress over time, belt levels, where the belts are, squad comparisons and weekly movement. Charts follow the current filters."),
  s("M8", "/", "chart-view", "click", "Switch chart views", "Switch between the chart and a table of the same numbers."),
  s("M9", "/leaderboard", "lb-podium", "none", "Explore the rankings", "The podium shows the top three in the current leaderboard scope."),
  s("M11", "/leaderboard", "lb-scope", "click", "Choose your scope", "Switch between the scopes your account can see."),
  s("M12", "/leaderboard", "lb-filters", "click", "Narrow the leaderboard", "Filter by university, squad or week, or search for a student. A narrower scope changes the ranking and how many students you see."),
  s("M13", "/leaderboard", "lb-layout", "click", "Choose a layout", "Switch between List and Belt cards. The layout changes the presentation, not the ranking."),
  s("M10", "/leaderboard/language", "lb-languages", "click", "Filter by language", "Choose a language to see its belt rankings."),
  s("M14", "/weekly-comparison", ["wc-weeks", "wc-filters"], "click", "Compare two periods", "Pick the two weeks to compare and any filters. Both weeks should be in the academic year you mean."),
  s("M15", "/weekly-comparison", "wc-summary", "click", "Understand the comparison", "Students are split into improved, no change and missing data. Click a segment to filter the list. Missing data doesn't mean no improvement."),
  s("M16", "/weekly-comparison", "wc-table", "click", "Inspect each student", "The table shows each student's belts in both weeks and the difference. Show more reveals more rows."),
  s("M17", "/analytics", "an-tabs", "click", "Monthly or yearly", "Switch between Monthly and Yearly analytics to look at different periods."),
  s("M18", "/analytics", "an-filters", "click", "Refine the analysis", "Use the year, month, squad and language filters. New results load after each change."),
  s("M19", "/analytics", "an-summary", "none", "Read the summary", "A one-sentence summary and the improvement-rate ring give the high-level picture for the selected period."),
  s("M20", "/analytics", "an-tiles", "click", "Explore the statistics", "Click a tile to see the data behind it. The selected period and filters still apply."),
  s("M21", "/analytics", "an-trend", "click", "Follow the trend", "See progress across the year or month by month."),
  ...CLOSING,
];

// ─── Campus manager ────────────────────────────────────────────────────────────
const CAMPUS_MANAGER: TutorialStep[] = [
  s("CM1", "/", "dash-header", "none", "Your campus dashboard", "Start with the campus, academic year, selected week and latest import time. Confirm the period before comparing results."),
  s("CM2", "/", "dash-headline", "none", "Weekly belt progress", "How many belts were gained this week and how many students moved up compared with the previous week, when there is one."),
  s("CM3", "/", "dash-filters", "click", "Select the academic period", "Choose the academic year and week. Week numbers repeat every academic year, so always check both."),
  s("CM4", "/", "kpi-tested", "click", "Students tested", "Test coverage for the selected week. Click the tile to see who was and wasn't tested."),
  s("CM5", "/", "kpi-moved", "click", "Students who moved up", "Students who earned at least one new belt compared with their previous test. The small bars show every week."),
  s("CM6", "/", "kpi-untested", "click", "Students not tested", "Gaps in this week's test coverage. A missing result never means a belt was lost."),
  s("CM7", "/", "needs-attention", "click", "Follow up where needed", "Students not tested, squads with low coverage, and stalled students (no new belt across the last three tests). Click a row for the names."),
  s("CM8", "/", "top-movers", "click", "Find the top movers", "The students who gained the most belts in the selected period."),
  s("CM9", "/", "squad-table", "click", "Compare your squads", "Students, test coverage, average belts, change against last week and strongest language for each squad. Click a row to open the squad."),
  s("CM10", "/", "chart-tabs", "click", "Explore dashboard charts", "Move between progress over time, belt levels, where the belts are, squad comparisons and weekly movement."),
  s("CM11", "/", "chart-controls", "click", "Adjust a chart", "Each chart has its own controls for metric, language, scope or grouping."),
  s("CM12", "/", "chart-view", "click", "Chart or table", "Switch between the chart and a table. This changes the view, not the data."),
  s("CM13", "/", "chart-arrows", "click", "Move through charts", "Use the previous and next buttons to browse the charts."),
  s("CM14", "/", "chart-tab-movement", "click", "Understand weekly movement", "Open the Weekly movement tab. It separates students who moved up, showed no change, had their first record, or weren't tested. These categories mean different things."),
  s("CM15", "/", "range-controls", "click", "Compare a date range", "Use the presets or From and To to compare a stretch of weeks."),
  s("CM16", "/", "range-stats", "none", "Summarize the change", "Belts gained, students improved, average gain and students with no change across the range."),
  s("CM17", "/", "range-languages", "none", "Compare languages", "How the belts gained in the range are spread across languages."),
  s("CM18", "/", "range-list", "click", "Find individual students", "Search and sort the students. Click one to open their history."),
  s("CM19", "*", ["upload", "upload-mobile", "mobile-menu"], "csv-demo", "Upload CSV, safely", "This is where you upload each week's belt-test results. We'll walk through the upload with a clearly labelled sample file, so nothing is imported."),
  s("CM29", "/students", "st-actions", "click", "Manage students and squads", "Create a squad, add a student, or import a roster CSV from here. These change campus data, so take a moment before saving."),
  s("CM30", "/students", "st-new-squad", "guarded", "Create a squad", "New squad asks for the university and a squad number. The button is paused during the tutorial, so nothing is created."),
  s("CM31", "/students", "st-add-student", "guarded", "Add a student", "Add student asks for a full name, email, university and squad. The button is paused during the tutorial, so nothing is created."),
  s("CM32", "/students", "st-stats", "none", "Student and squad statistics", "Counts and summary numbers for your campus's students and squads."),
  s("CM33", "/students", "st-squads", "click", "Filter by squad", "Click a squad card to filter the list below. Copy squad ID copies the identifier for support requests."),
  s("CM34", "/students", "st-toolbar", "click", "Find the right student", "Search, sort and switch between cards and a list."),
  s("CM35", "/students", "st-collection", "click", "Open a student profile", "Open a student to see their profile and history. Edits only happen when you save them yourself."),
  s("CM36", "/students", "st-monitor", "none", "Monitor test coverage", "In monitoring view, each student is marked tested or not tested for the selected week. A missing result doesn't mean a lost belt."),
  s("CM37", "/students/stalled", "stalled-intro", "click", "Identify stalled students", "Stalled means no new belt across the last three tests. Use the squad, week and search controls to look into it."),
  s("CM38", "/imports", "im-filters", "click", "Filter import history", "Search imports and filter by status or week. Filters only change what's shown."),
  s("CM39", "/imports", "im-table", "click", "Review past imports", "Every upload with who uploaded it, when, for which week, and whether it worked. Opening one is read-only."),
  s("CM40", "/imports", "im-pages", "click", "Browse older imports", "Move through older history page by page."),
  s("CM41", "/imports/[id]", "imd-meta", "none", "Inspect an import", "The import ID, upload date, week, row count and validation errors for this upload."),
  s("CM42", "/imports/[id]", "imd-records", "none", "Imported student records", "The student records this import saved. Viewing them changes nothing."),
  s("CM43", "/imports/[id]", "imd-raw", "none", "Inspect the source rows", "Exactly what the uploaded CSV contained, kept as history."),
  s("CM44", "/imports/[id]", "imd-errors", "none", "Review validation errors", "Row-level reasons a row or file was rejected."),
  ...CLOSING,
];

// ─── Super admin ───────────────────────────────────────────────────────────────
const SUPER_ADMIN: TutorialStep[] = [
  s("SA1", "/universities", "uni-intro", "none", "Manage universities", "Every campus on the platform, with its students, squads and campus team."),
  s("SA2", "/universities", "uni-table", "click", "Explore university records", "Each row shows a university's students, squads, mentors and campus managers. Click Details to see its squads and team."),
  s("SA3", "/universities", "uni-rename", "guarded", "Rename a university", "The pencil turns the name into an editable field. It's paused during the tutorial, so no rename can happen."),
  s("SA4", "/universities", "uni-save", "guarded", "Save or cancel", "While editing, Save commits the new name and Cancel discards it."),
  s("SA5", "/universities", "uni-squads", "none", "Review squads", "The squads that belong to this university."),
  s("SA6", "/universities", "uni-team", "none", "Review the campus team", "The mentors and campus managers assigned to this university."),
  s("SA7", "/universities", "uni-intro", "none", "Understand your scope", "As a super admin you can manage every university. Check which one you're on before changing anything."),
  s("SA8", "/users", "users-intro", "none", "Manage access", "Access requests and user administration. Roles, universities and mentor squads control what people can see."),
  s("SA9", "/users", "ar-panel", "none", "Review access requests", "People who signed in and asked for access, with the role, university and details they gave. Opening a request doesn't decide it."),
  s("SA10", "/users", "ar-grant", "click", "Assign a role and university", "Choose the role and university to grant. Nothing is saved until you approve."),
  s("SA11", "/users", "ar-squads", "click", "Assign mentor squads", "For mentors, pick the squads they'll look after. This decides which students they can see."),
  s("SA12", "/users", "ar-approve", "guarded", "Approving a request", "Approve grants the access you set and emails the person. It's paused during the tutorial."),
  s("SA13", "/users", "ar-reject", "guarded", "Rejecting a request", "Reject declines the request and emails the person. It's paused during the tutorial."),
  s("SA14", "/users", "users-table", "none", "Manage existing users", "Everyone with access: role, university or linked student, and whether they've signed in yet."),
  s("SA15", "/users", "users-search", "click", "Find a user", "Search by name or email and filter by role. Filtering is read-only."),
  s("SA16", "/users", "users-edit", "guarded", "Change a user's role", "Edit loads a user into the form above so you can change their role. It's paused during the tutorial."),
  s("SA17", "/users", "users-assign", "none", "Role and university assignment", "This form sets a user's name, email, role and university. Changes apply only when you save."),
  s("SA18", "/users", "users-squads", "none", "Review mentor assignments", "For a mentor, these are the squads they look after."),
  s("SA19", "/users", "users-delete", "guarded", "Deletion requires care", "Deleting a user needs a long press and a confirmation, and it can't be undone. It's paused during the tutorial."),
  s("SA20", "/users", "users-table", "none", "Recognize saving states", "After a change, wait for the row to finish saving before assuming it worked."),
  s("SA21", "/audit-logs", "audit-intro", "none", "Audit history", "Every import, assignment and edit, newest first. Use it to investigate, not to change things."),
  s("SA22", "/audit-logs", "audit-list", "none", "Review recorded actions", "Each entry is one recorded action."),
  s("SA23", "/audit-logs", "audit-actor", "none", "Who performed the action", "The person who did it, and what kind of record it affected."),
  s("SA24", "/audit-logs", "audit-action", "none", "What changed", "The action that was recorded. Entries don't all carry the same detail."),
  s("SA25", "/audit-logs", "audit-time", "none", "When it happened", "When the action was recorded, in your local time."),
  s("SA27", "/audit-logs", "audit-list", "none", "Keep the audit trail trustworthy", "Audit entries can't be edited or deleted, so the history stays accurate."),
  s("SA28", "/support/inbox", "inbox-intro", "none", "Support inbox", "Every bug report and feature request. Ticket actions can notify the reporter."),
  s("SA29", "/support/inbox", "inbox-filters", "click", "Filter tickets", "Filter by status, type, severity and assignee. Filtering doesn't change tickets."),
  s("SA30", "/support/inbox", "inbox-search", "click", "Search tickets", "Search by title, reporter or email. Current filters still apply."),
  s("SA31", "/support/inbox", "inbox-refresh", "click", "Refresh the inbox", "Fetch the latest tickets. Refreshing doesn't send or change anything."),
  s("SA32", "/support/inbox", "inbox-list", "click", "Select a ticket", "Pick a ticket to open its conversation and details. Opening it doesn't reply or change its status."),
  s("SA33", "/support/inbox", "tk-details", "none", "Understand the report", "The reporter, the page and browser they reported from, and the ticket's type and timing."),
  s("SA34", "/support/inbox", "tk-thread", "none", "Read the conversation", "The full history with the reporter. Read it before replying."),
  s("SA35", "/support/inbox", "tk-internal", "guarded", "Internal notes", "Turn this on to write a note only the support team sees. It's paused during the tutorial."),
  s("SA36", "/support/inbox", "tk-assignee", "guarded", "Assign responsibility", "Choose who owns the ticket. It's paused during the tutorial."),
  s("SA37", "/support/inbox", "tk-status", "guarded", "Update ticket status", "Move the ticket through its workflow. It's paused during the tutorial."),
  s("SA38", "/support/inbox", "tk-severity", "guarded", "Set severity", "How urgent the issue is. It's paused during the tutorial."),
  s("SA40", "/support/inbox", "tk-changelog", "guarded", "Turn an issue into an update", "Prepare a What's new entry from a fixed ticket. It's paused during the tutorial."),
  s("SA41", "/support/inbox", "inbox-intro", "none", "Confirm before acting", "Messages, notes, ticket changes and changelog entries take effect immediately. Make sure you mean it."),
  ...CLOSING,
];

export const TOURS: Record<TutorialRole, TutorialStep[]> = {
  student: STUDENT,
  mentor: MENTOR,
  campus_manager: CAMPUS_MANAGER,
  super_admin: SUPER_ADMIN,
};

export const ROLE_LABELS: Record<TutorialRole, string> = {
  student: "Student",
  mentor: "Mentor",
  campus_manager: "Campus manager",
  super_admin: "Super admin",
};

/** Which tour a profile gets; developers and unassigned people get none. */
export function tutorialRoleFor(profile: {
  role: string | null;
  is_developer?: boolean;
  viewing_as?: { role: string } | null;
}): TutorialRole | null {
  const role = profile.viewing_as ? profile.viewing_as.role : profile.is_developer ? null : profile.role;
  return role === "student" || role === "mentor" || role === "campus_manager" || role === "super_admin" ? role : null;
}

/** Index of the first step after the current page's run of steps. */
export function nextPageIndex(steps: TutorialStep[], index: number) {
  const page = steps[index]?.page;
  let next = index + 1;
  while (next < steps.length && steps[next].page === page) next += 1;
  return next;
}

/** Index of the first step on the given path, or -1. */
export function firstStepOn(steps: TutorialStep[], pathname: string) {
  return steps.findIndex((step) => step.page !== "*" && pageMatches(step.page, pathname));
}

// ─── Optional checklist ────────────────────────────────────────────────────────
export type ChecklistItem = { id: string; label: string; href: string };

export const CHECKLISTS: Record<TutorialRole, ChecklistItem[]> = {
  student: [
    { id: "profile", label: "Look at your belts and progress", href: "/student" },
    { id: "leaderboard", label: "Find your rank on the leaderboard", href: "/leaderboard" },
    { id: "language", label: "Check a language leaderboard", href: "/leaderboard/language" },
  ],
  mentor: [
    { id: "dashboard", label: "Check this week's dashboard", href: "/" },
    { id: "comparison", label: "Compare two weeks", href: "/weekly-comparison" },
    { id: "analytics", label: "Look at monthly analytics", href: "/analytics" },
    { id: "leaderboard", label: "Browse the leaderboard", href: "/leaderboard" },
  ],
  campus_manager: [
    { id: "dashboard", label: "Check this week's dashboard", href: "/" },
    { id: "students", label: "Review your squads and students", href: "/students" },
    { id: "imports", label: "Look through import history", href: "/imports" },
    { id: "comparison", label: "Compare two weeks", href: "/weekly-comparison" },
  ],
  super_admin: [
    { id: "universities", label: "Review universities", href: "/universities" },
    { id: "users", label: "Check users and access requests", href: "/users" },
    { id: "tickets", label: "Open the support inbox", href: "/support/inbox" },
    { id: "audit", label: "Skim the audit logs", href: "/audit-logs" },
  ],
};

// ─── CSV demo (synthetic, never uploaded) ──────────────────────────────────────
export const CSV_DEMO_STAGES = [
  { id: "CM20", title: "Choose the campus", body: "Your campus is fixed to the one you're assigned to. This is a demo with made-up data, so nothing is sent anywhere." },
  { id: "CM21", title: "Choose a sample file", body: "Pick the sample file below. In a real upload you'd choose the CSV exported after the Friday belt test (up to 10 MB)." },
  { id: "CM22", title: "Preview before importing", body: "A real upload first checks the file and shows the academic year, weeks, records, unique students, new vs existing students, and memberships that would be added." },
  { id: "CM23", title: "Understand validation errors", body: "Problems are listed row by row so you can fix them first. A file with validation errors can't be imported." },
  { id: "CM24", title: "New and existing students", body: "The preview separates new students from ones already on record, and shows which squad memberships would be added." },
  { id: "CM25", title: "See a simulated result", body: "Press Import (demo) to see what happens next. Nothing is imported." },
  { id: "CM26", title: "Review the result", body: "A real import reports students created, memberships created, students already assigned, and any errors." },
  { id: "CM27", title: "Manage squads separately", body: "After an import, Manage squads takes you to the Students page to tidy squads and students." },
  { id: "CM28", title: "Finish the walkthrough", body: "Close the demo when you're ready. No import was performed." },
] as const;

export const CSV_DEMO_SAMPLE = {
  fileName: "sample-belt-test (demo).csv",
  academicYear: "2026–27",
  weeks: [9],
  records: 6,
  students: [
    { name: "Demo Student A", squad: "Demo 1", status: "existing" },
    { name: "Demo Student B", squad: "Demo 1", status: "existing" },
    { name: "Demo Student C", squad: "Demo 2", status: "new" },
    { name: "Demo Student D", squad: "Demo 2", status: "existing" },
    { name: "Demo Student E", squad: "Demo 2", status: "new" },
  ],
  errors: [{ row: 6, problem: "Belt level “Purple+” isn't a known belt" }],
  result: { studentsCreated: 2, membershipsCreated: 2, alreadyAssigned: 3, errors: 1 },
} as const;

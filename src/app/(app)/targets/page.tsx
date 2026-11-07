"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CornerDownLeft, FlaskConical, Mail, MousePointerClick, Search, Star, Target, Trash2, X } from "lucide-react";
import { useCachedProfile } from "@/lib/auth/use-cached-profile";
import { getCurrentUserProfile, type CurrentUserProfile } from "@/lib/auth/profile";
import { Frame, FrameTitle, Page } from "@/components/ui/frame";
import { Dropdown } from "@/components/ui/dropdown";
import { FormBanner } from "@/components/ui/form";
import { PanelSkeleton } from "@/components/ui/skeleton";
import { LANGUAGE_COLORS } from "@/components/dashboard/chart-kit";
import {
  TARGET_LANGUAGES,
  TARGET_LANGUAGE_LABELS,
  daysLeft,
  describeTarget,
  monthKey,
  monthLabel,
  targetProgress,
  totalBelts,
  type BeltTarget,
  type Levels,
  type TargetLanguage,
} from "@/lib/belt-targets";

type Row = {
  id: string;
  name: string;
  squad_id: string;
  squad_number: string;
  university_id: string;
  university_name: string | null;
  primary_language: TargetLanguage | null;
  secondary_language: TargetLanguage | null;
  start: Levels;
  now: Levels;
  tested: boolean;
  target: BeltTarget | null;
};
type University = { id: string; name: string };

const AUTO_PICK_KEY = "dojo-targets-autopick";
function readAutoPick() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(AUTO_PICK_KEY) !== "off";
  } catch {
    return true;
  }
}

function nextMonth() {
  const today = new Date();
  return monthKey(new Date(today.getFullYear(), today.getMonth() + 1, 1));
}

/** Mentors and managers set monthly belt targets for their students. */
export default function TargetsPage() {
  const cachedProfile = useCachedProfile();
  // The cache is empty on a fresh page load, so fetch the profile as well.
  const [loadedProfile, setLoadedProfile] = useState<CurrentUserProfile | null>(null);
  useEffect(() => {
    let active = true;
    getCurrentUserProfile()
      .then((result) => active && setLoadedProfile(result))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const cached = loadedProfile ?? cachedProfile;
  const isSuperAdmin = cached?.status === "authenticated" && cached.profile.role === "super_admin";
  const isDeveloper = cached?.status === "authenticated" && cached.profile.is_developer && !cached.profile.viewing_as;
  const [testCount, setTestCount] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [month, setMonth] = useState(monthKey());
  const [universities, setUniversities] = useState<University[]>([]);
  const [universityId, setUniversityId] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [squad, setSquad] = useState("all");
  const [beltFilter, setBeltFilter] = useState("all"); // "all" | "total:N" | "primary:N" | "secondary:N" | "<language>:N"
  const [primaryFilter, setPrimaryFilter] = useState("all"); // "all" | "none" | "<language>"
  const [targetFilter, setTargetFilter] = useState<"all" | "none" | "set">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Search auto-select: the top match is added once typing pauses, so typing
  // name after name builds a list. The pick follows the search while you're
  // still typing that name, and sticks once you clear it or press Enter.
  const [autoPick, setAutoPick] = useState(readAutoPick);
  const autoPicked = useRef<string | null>(null);
  // Whether that pick was added by auto-select (vs. already ticked by hand).
  const autoAdded = useRef(false);
  const selectedNow = useRef(selected);
  useEffect(() => {
    selectedNow.current = selected;
  }, [selected]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    let active = true;
    fetch("/api/super-admin/universities")
      .then((response) => response.json())
      .then((result: { universities?: University[] }) => {
        if (!active) return;
        const list = result.universities ?? [];
        setUniversities(list);
        setUniversityId((current) => current || list[0]?.id || "");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isSuperAdmin]);

  const load = useCallback(() => {
    if (isSuperAdmin && !universityId) return Promise.resolve();
    const query = new URLSearchParams({ month });
    if (isSuperAdmin) query.set("university_id", universityId);
    return fetch(`/api/targets?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as { students?: Row[]; testCount?: number; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Couldn’t load students.");
        setRows(result.students ?? []);
        setTestCount(result.testCount ?? 0);
        setError("");
      })
      .catch((loadError) => {
        setRows([]);
        setError(loadError instanceof Error ? loadError.message : "Couldn’t load students.");
      });
  }, [month, isSuperAdmin, universityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const squads = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows ?? []) map.set(row.squad_id, row.squad_number);
    return [...map].sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }));
  }, [rows]);

  // Belt levels present, for "everyone at the same level" picking.
  const levelOptions = useMemo(() => {
    const totals = new Set<number>();
    const primary = new Set<number>();
    const secondary = new Set<number>();
    const perLanguage = new Map<TargetLanguage, Set<number>>(TARGET_LANGUAGES.map((language) => [language, new Set()]));
    for (const row of rows ?? []) {
      totals.add(totalBelts(row.now));
      if (row.primary_language) primary.add(row.now[row.primary_language]);
      if (row.secondary_language) secondary.add(row.now[row.secondary_language]);
      for (const language of TARGET_LANGUAGES) perLanguage.get(language)!.add(row.now[language]);
    }
    const sorted = (values: Set<number>) => [...values].sort((a, b) => a - b);
    return {
      totals: sorted(totals),
      primary: sorted(primary),
      secondary: sorted(secondary),
      perLanguage: TARGET_LANGUAGES.map((language) => [language, sorted(perLanguage.get(language)!)] as const),
    };
  }, [rows]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const [kind, level] = beltFilter.split(":");
    return (rows ?? [])
      .filter((row) => !needle || row.name.toLowerCase().includes(needle))
      .filter((row) => squad === "all" || row.squad_id === squad)
      .filter((row) => (primaryFilter === "all" ? true : primaryFilter === "none" ? !row.primary_language : row.primary_language === primaryFilter))
      .filter((row) => {
        if (beltFilter === "all") return true;
        if (kind === "total") return totalBelts(row.now) === Number(level);
        if (kind === "primary") return Boolean(row.primary_language) && row.now[row.primary_language!] === Number(level);
        if (kind === "secondary") return Boolean(row.secondary_language) && row.now[row.secondary_language!] === Number(level);
        return row.now[kind as TargetLanguage] === Number(level);
      })
      .filter((row) => (targetFilter === "all" ? true : targetFilter === "set" ? Boolean(row.target) : !row.target))
      .sort((a, b) => a.squad_number.localeCompare(b.squad_number, undefined, { numeric: true }) || a.name.localeCompare(b.name));
  }, [rows, search, squad, beltFilter, primaryFilter, targetFilter]);

  const topMatch = search.trim().length >= 2 ? (visible[0]?.id ?? null) : null;
  useEffect(() => {
    if (!search.trim()) {
      autoPicked.current = null;
      return;
    }
    if (!autoPick || !topMatch || topMatch === autoPicked.current) return;
    const timer = window.setTimeout(() => {
      const previous = autoAdded.current ? autoPicked.current : null;
      autoPicked.current = topMatch;
      autoAdded.current = !selectedNow.current.has(topMatch);
      setSelected((current) => {
        const next = new Set(current);
        // Still refining the same name: swap out the earlier guess.
        if (previous) next.delete(previous);
        next.add(topMatch);
        return next;
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [search, topMatch, autoPick]);

  function pickTopAndClear() {
    const top = visible[0];
    if (search.trim() && top) setSelected((current) => new Set(current).add(top.id));
    autoPicked.current = null;
    setSearch("");
  }

  function toggleAutoPick() {
    setAutoPick((current) => {
      try {
        window.localStorage.setItem(AUTO_PICK_KEY, current ? "off" : "on");
      } catch {
        // Storage can be blocked; the choice still applies now.
      }
      return !current;
    });
  }

  const allVisibleSelected = visible.length > 0 && visible.every((row) => selected.has(row.id));
  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      for (const row of visible) {
        if (allVisibleSelected) next.delete(row.id);
        else next.add(row.id);
      }
      return next;
    });
  }
  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function clearTestTargets() {
    if (!window.confirm(`Delete all ${testCount} test target${testCount === 1 ? "" : "s"}? Real targets are not touched.`)) return;
    setClearing(true);
    try {
      const response = await fetch("/api/targets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allTests: true }),
      });
      const result = (await response.json()) as { removed?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Couldn’t delete the test targets.");
      setNotice(`Deleted ${result.removed} test target${result.removed === 1 ? "" : "s"}.`);
      setError("");
      await load();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Couldn’t delete the test targets.");
    } finally {
      setClearing(false);
    }
  }

  const withTargets = (rows ?? []).filter((row) => row.target).length;
  const reached = (rows ?? []).filter((row) => row.target && targetProgress(row.target, row.start, row.now).done).length;

  return (
    <Page>
      <Frame>
        <FrameTitle
          eyebrow="Insights"
          title="Belt targets"
          description="Set how many belts students should gain this month, for a few students, everyone at a belt level, or a whole squad. Students get an email and see their progress on their profile."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {isDeveloper && testCount > 0 ? (
                <button
                  type="button"
                  disabled={clearing}
                  onClick={() => void clearTestTargets()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 text-[13px] font-medium text-amber-600 transition hover:bg-amber-500/15 disabled:opacity-60 dark:text-amber-400"
                >
                  <FlaskConical size={14} />
                  {clearing ? "Deleting…" : `Delete ${testCount} test target${testCount === 1 ? "" : "s"}`}
                </button>
              ) : null}
              {isSuperAdmin ? (
                <Dropdown
                  chevron
                  aria-label="University"
                  value={universityId}
                  onChange={(value) => {
                    setRows(null);
                    setSelected(new Set());
                    setUniversityId(value);
                  }}
                  className="h-9 min-w-[180px] rounded-lg border border-line-strong bg-surface px-3 text-[13px]"
                >
                  {universities.map((university) => (
                    <option key={university.id} value={university.id}>
                      {university.name}
                    </option>
                  ))}
                </Dropdown>
              ) : null}
              <div className="flex rounded-lg bg-sunken p-0.5" role="group" aria-label="Month">
                {[monthKey(), nextMonth()].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={month === value}
                    onClick={() => {
                      setRows(null);
                      setSelected(new Set());
                      setMonth(value);
                    }}
                    className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium transition ${
                      month === value
                        ? "bg-surface text-ink shadow-[var(--card-shadow)] ring-[0.5px] ring-line"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {monthLabel(value)}
                  </button>
                ))}
              </div>
            </div>
          }
        />

        <div className="grid border-b border-line sm:grid-cols-3 sm:divide-x sm:divide-line">
          {[
            ["Students", rows?.length ?? 0],
            ["With a target", withTargets],
            ["Target reached", reached],
          ].map(([label, value]) => (
            <div key={label} className="px-5 py-4">
              <p className="text-[12.5px] text-muted">{label}</p>
              <p className="mt-0.5 text-[24px] font-semibold tracking-[-0.02em] tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div data-tour="targets-filters" className="flex flex-wrap items-center gap-2 bg-surface-2 px-4 py-3 sm:px-5">
          <label className="flex h-9 min-w-52 flex-1 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3">
            <Search size={15} className="text-muted" />
            <span className="sr-only">Search students</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  pickTopAndClear();
                } else if (event.key === "Escape") {
                  autoPicked.current = null;
                  setSearch("");
                }
              }}
              placeholder={autoPick ? "Type names one after another to select them" : "Search students"}
              className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-faint"
            />
            {search.trim() && visible[0] ? (
              <span className="hidden shrink-0 items-center gap-1 text-[11.5px] text-faint sm:inline-flex">
                <CornerDownLeft size={12} /> add {visible[0].name.split(" ")[0]}
              </span>
            ) : null}
          </label>
          <button
            type="button"
            aria-pressed={autoPick}
            onClick={toggleAutoPick}
            title="Select the top match automatically while you type"
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition ${
              autoPick ? "border-action/40 bg-action/10 text-ink" : "border-line-strong bg-surface text-muted hover:text-ink"
            }`}
          >
            <MousePointerClick size={14} className={autoPick ? "text-action" : ""} />
            Auto-select {autoPick ? "on" : "off"}
          </button>
          <Dropdown chevron aria-label="Squad" value={squad} onChange={setSquad} className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-[13px]">
            <option value="all">All squads</option>
            {squads.map(([id, number]) => (
              <option key={id} value={id}>
                Squad {number}
              </option>
            ))}
          </Dropdown>
          <Dropdown
            chevron
            aria-label="Primary language"
            value={primaryFilter}
            onChange={setPrimaryFilter}
            className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-[13px]"
          >
            <option value="all">Any primary language</option>
            {TARGET_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                Primary: {TARGET_LANGUAGE_LABELS[language]}
              </option>
            ))}
            <option value="none">No language chosen</option>
          </Dropdown>
          <Dropdown chevron aria-label="Belt level" value={beltFilter} onChange={setBeltFilter} className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-[13px]">
            <option value="all">Any belt level</option>
            <optgroup label="Primary language belt">
              {levelOptions.primary.map((level) => (
                <option key={`primary-${level}`} value={`primary:${level}`}>
                  Primary belt {level}
                </option>
              ))}
            </optgroup>
            <optgroup label="Secondary language belt">
              {levelOptions.secondary.map((level) => (
                <option key={`secondary-${level}`} value={`secondary:${level}`}>
                  Secondary belt {level}
                </option>
              ))}
            </optgroup>
            <optgroup label="Total belts held">
              {levelOptions.totals.map((level) => (
                <option key={`total-${level}`} value={`total:${level}`}>
                  {level} belts in total
                </option>
              ))}
            </optgroup>
            {levelOptions.perLanguage.map(([language, levels]) => (
              <optgroup key={language} label={TARGET_LANGUAGE_LABELS[language]}>
                {levels.map((level) => (
                  <option key={`${language}-${level}`} value={`${language}:${level}`}>
                    {TARGET_LANGUAGE_LABELS[language]} at belt {level}
                  </option>
                ))}
              </optgroup>
            ))}
          </Dropdown>
          <Dropdown
            chevron
            aria-label="Target"
            value={targetFilter}
            onChange={(value) => setTargetFilter(value as typeof targetFilter)}
            className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-[13px]"
          >
            <option value="all">With or without a target</option>
            <option value="none">No target yet</option>
            <option value="set">Has a target</option>
          </Dropdown>
        </div>

        {notice ? (
          <div className="px-4 pt-3 sm:px-5">
            <FormBanner tone="success">{notice}</FormBanner>
          </div>
        ) : null}
        {error ? (
          <div className="px-4 pt-3 sm:px-5">
            <FormBanner tone="error">{error}</FormBanner>
          </div>
        ) : null}

        {rows === null ? (
          <PanelSkeleton rows={6} label="Loading students" flat />
        ) : (
          <div data-tour="targets-list" className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[13.5px]">
              <thead className="text-[12px] text-muted">
                <tr className="border-b border-line">
                  <th className="w-10 px-4 py-2.5 sm:px-5">
                    <input
                      type="checkbox"
                      aria-label="Select all shown"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      className="size-4 accent-[var(--action)]"
                    />
                  </th>
                  <th className="px-3 py-2.5 font-medium">Student</th>
                  <th className="px-3 py-2.5 font-medium">Belts now</th>
                  <th className="px-3 py-2.5 font-medium">{monthLabel(month)} target</th>
                  <th className="px-4 py-2.5 font-medium sm:px-5">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-muted">
                      No students match.
                    </td>
                  </tr>
                ) : (
                  visible.map((row) => {
                    const progress = row.target ? targetProgress(row.target, row.start, row.now) : null;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => toggle(row.id)}
                        className={`cursor-pointer transition-colors ${selected.has(row.id) ? "bg-sunken" : "hover:bg-sunken/50"}`}
                      >
                        <td className="px-4 py-2.5 sm:px-5" onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${row.name}`}
                            checked={selected.has(row.id)}
                            onChange={() => toggle(row.id)}
                            className="size-4 accent-[var(--action)]"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-ink">{row.name}</p>
                          <p className="text-[12px] text-muted">
                            {isSuperAdmin && row.university_name ? `${row.university_name} · ` : ""}Squad {row.squad_number}
                          </p>
                          <LanguagePair primary={row.primary_language} secondary={row.secondary_language} levels={row.now} />
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-ink-2">
                            <span className="font-semibold text-ink tabular-nums">{totalBelts(row.now)}</span>
                            {TARGET_LANGUAGES.map((language) => (
                              <span key={language} className="inline-flex items-center gap-1 tabular-nums">
                                <span className="size-2 rounded-full" style={{ background: LANGUAGE_COLORS[language] }} aria-hidden="true" />
                                {row.now[language]}
                                <span className="sr-only">{TARGET_LANGUAGE_LABELS[language]}</span>
                              </span>
                            ))}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {row.target ? (
                            <span className="inline-flex items-center gap-1.5 text-ink">
                              {describeTarget(row.target)}
                              {row.target.is_test ? <TestBadge /> : null}
                            </span>
                          ) : (
                            <span className="text-faint">No target</span>
                          )}
                          {row.target?.set_by_name ? (
                            <span className="block text-[11.5px] text-muted">by {row.target.set_by_name}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 sm:px-5">
                          {progress ? <ProgressBar gained={progress.gained} goal={progress.goal} done={progress.done} /> : <span className="text-faint">—</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </Frame>

      {selected.size ? (
        <TargetBar
          count={selected.size}
          month={month}
          canTest={isDeveloper}
          onClear={() => setSelected(new Set())}
          onSave={async (input) => {
            const response = await fetch("/api/targets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...input, month, studentIds: [...selected] }),
            });
            const result = (await response.json()) as { saved?: number; emailed?: number; emailFailed?: number; error?: string };
            if (!response.ok) throw new Error(result.error ?? "Couldn’t save the target.");
            setNotice(
              `${input.test ? "Test target" : "Target"} set for ${result.saved} student${result.saved === 1 ? "" : "s"}${
                result.emailed ? `; ${result.emailed} emailed` : ""
              }${result.emailFailed ? `; ${result.emailFailed} email${result.emailFailed === 1 ? "" : "s"} couldn’t be sent` : ""}.`,
            );
            setSelected(new Set());
            await load();
          }}
          onRemove={async () => {
            const response = await fetch("/api/targets", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ month, studentIds: [...selected] }),
            });
            const result = (await response.json()) as { removed?: number; error?: string };
            if (!response.ok) throw new Error(result.error ?? "Couldn’t remove the targets.");
            setNotice(`Removed the target for ${result.removed} student${result.removed === 1 ? "" : "s"}.`);
            setSelected(new Set());
            await load();
          }}
        />
      ) : null}
    </Page>
  );
}

/** The student's primary (filled star) and secondary language, with their current belt in each. */
function LanguagePair({ primary, secondary, levels }: { primary: TargetLanguage | null; secondary: TargetLanguage | null; levels: Levels }) {
  if (!primary) return <p className="mt-1 text-[11.5px] text-faint">No primary language chosen</p>;
  const chip = (language: TargetLanguage, kind: "Primary" | "Secondary") => (
    <span
      title={`${kind}: ${TARGET_LANGUAGE_LABELS[language]}, belt ${levels[language]}`}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium ${
        kind === "Primary" ? "bg-ink/[0.07] text-ink" : "border border-line text-ink-2"
      }`}
    >
      {kind === "Primary" ? <Star size={11} className="fill-current text-amber-500" /> : <Star size={11} className="text-muted" />}
      <span className="size-1.5 rounded-full" style={{ background: LANGUAGE_COLORS[language] }} aria-hidden="true" />
      {TARGET_LANGUAGE_LABELS[language]}
      <span className="tabular-nums text-muted">{levels[language]}</span>
    </span>
  );
  return (
    <p className="mt-1 flex flex-wrap gap-1">
      {chip(primary, "Primary")}
      {secondary ? chip(secondary, "Secondary") : null}
    </p>
  );
}

function TestBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
      <FlaskConical size={11} /> Test
    </span>
  );
}

function ProgressBar({ gained, goal, done }: { gained: number; goal: number; done: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-sunken">
        <div
          className={`h-full rounded-full ${done ? "bg-success-text" : "bg-action"}`}
          style={{ width: `${goal ? Math.min(100, (gained / goal) * 100) : 0}%` }}
        />
      </div>
      <span className={`text-[12.5px] tabular-nums ${done ? "font-medium text-success-text" : "text-ink-2"}`}>
        {gained}/{goal}
        {done ? " ✓" : ""}
      </span>
    </div>
  );
}

/** Sticky bar at the bottom: set the target for the selected students. */
function TargetBar({
  count,
  month,
  canTest,
  onClear,
  onSave,
  onRemove,
}: {
  count: number;
  month: string;
  canTest: boolean;
  onClear: () => void;
  onSave: (input: {
    totalGain?: number;
    languageGains?: Partial<Levels>;
    primaryGain?: number;
    secondaryGain?: number;
    note: string;
    notify: boolean;
    test: boolean;
  }) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  // Targets are mainly on each student's own primary and secondary language.
  const [mode, setMode] = useState<"main" | "total" | "language">("main");
  const [primaryGain, setPrimaryGain] = useState(1);
  const [secondaryGain, setSecondaryGain] = useState(1);
  const [total, setTotal] = useState(2);
  const [perLanguage, setPerLanguage] = useState<Partial<Levels>>({});
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  // Developers start in test mode, so a real student isn't emailed by accident.
  const [test, setTest] = useState(canTest);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [error, setError] = useState("");

  async function run(kind: "save" | "remove") {
    setBusy(kind);
    setError("");
    try {
      if (kind === "remove") await onRemove();
      else
        await onSave(
          mode === "main"
            ? { primaryGain, secondaryGain, note, notify: notify && !test, test }
            : mode === "total"
              ? { totalGain: total, note, notify: notify && !test, test }
              : { languageGains: perLanguage, note, notify: notify && !test, test },
        );
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const languageTotal = Object.values(perLanguage).reduce((sum, value) => sum + (value ?? 0), 0);
  const canSave = mode === "main" ? primaryGain + secondaryGain > 0 : mode === "total" ? total >= 1 : languageTotal > 0;

  return (
    <div data-tour="targets-bar" className="sticky bottom-4 z-30 mt-4">
      <div className="mx-auto max-w-4xl rounded-xl border border-line-strong bg-surface p-4 shadow-[var(--pop-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold">
            <Target size={16} className="text-brand" />
            {count} selected · target for {monthLabel(month)}
            {month === monthKey() ? <span className="font-normal text-muted">({daysLeft(month)} days left)</span> : null}
          </p>
          <div className="flex items-center gap-1">
            <div className="flex rounded-lg bg-sunken p-0.5" role="group" aria-label="Target type">
              {(
                [
                  ["main", "Primary & secondary"],
                  ["total", "Total belts"],
                  ["language", "Per language"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                  className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium transition ${
                    mode === value ? "bg-surface text-ink shadow-[var(--card-shadow)] ring-[0.5px] ring-line" : "text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button type="button" onClick={onClear} aria-label="Clear selection" className="ml-1 rounded-lg p-1.5 text-muted hover:bg-sunken hover:text-ink">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          {mode === "main" ? (
            <>
              {(
                [
                  ["Primary language", primaryGain, setPrimaryGain],
                  ["Secondary language", secondaryGain, setSecondaryGain],
                ] as const
              ).map(([label, value, set]) => (
                <label key={label} className="flex flex-col gap-1 text-[12px] font-medium text-ink-2">
                  <span className="inline-flex items-center gap-1.5">
                    <Star size={12} className={label.startsWith("Primary") ? "fill-current text-amber-500" : "text-muted"} />
                    {label} belts
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={value}
                    onChange={(event) => set(Math.max(0, Math.min(10, Number(event.target.value) || 0)))}
                    className="h-9 w-24 rounded-lg border border-line-strong bg-surface px-3 text-[14px] tabular-nums outline-none focus:border-ink"
                  />
                </label>
              ))}
              <p className="max-w-56 pb-2 text-[11.5px] leading-4 text-muted">
                Set on each student&apos;s own languages, so a Python + Java student and a Python + Node.js student both get the right belts.
              </p>
            </>
          ) : mode === "total" ? (
            <label className="flex flex-col gap-1 text-[12px] font-medium text-ink-2">
              Belts to gain
              <input
                type="number"
                min={1}
                max={40}
                value={total}
                onChange={(event) => setTotal(Math.max(1, Math.min(40, Number(event.target.value) || 1)))}
                className="h-9 w-24 rounded-lg border border-line-strong bg-surface px-3 text-[14px] tabular-nums outline-none focus:border-ink"
              />
            </label>
          ) : (
            TARGET_LANGUAGES.map((language) => (
              <label key={language} className="flex flex-col gap-1 text-[12px] font-medium text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: LANGUAGE_COLORS[language] }} aria-hidden="true" />
                  {TARGET_LANGUAGE_LABELS[language]}
                </span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={perLanguage[language] ?? 0}
                  onChange={(event) =>
                    setPerLanguage((current) => ({ ...current, [language]: Math.max(0, Math.min(10, Number(event.target.value) || 0)) }))
                  }
                  className="h-9 w-20 rounded-lg border border-line-strong bg-surface px-3 text-[14px] tabular-nums outline-none focus:border-ink"
                />
              </label>
            ))
          )}
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-[12px] font-medium text-ink-2">
            Note for students (optional)
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={300}
              placeholder="e.g. Focus on Python this month"
              className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-[13.5px] outline-none placeholder:text-faint focus:border-ink"
            />
          </label>
        </div>

        {error ? (
          <div className="mt-3">
            <FormBanner tone="error">{error}</FormBanner>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {canTest ? (
              <label className="inline-flex items-center gap-2 text-[13px] font-medium text-amber-600 dark:text-amber-400">
                <input type="checkbox" checked={test} onChange={(event) => setTest(event.target.checked)} className="size-4 accent-amber-500" />
                <FlaskConical size={14} /> Test target
                <span className="font-normal text-muted">(no email, hidden from students, delete anytime)</span>
              </label>
            ) : null}
            <label className={`inline-flex items-center gap-2 text-[13px] text-ink-2 ${test ? "opacity-50" : ""}`}>
              <input
                type="checkbox"
                disabled={test}
                checked={notify && !test}
                onChange={(event) => setNotify(event.target.checked)}
                className="size-4 accent-[var(--action)]"
              />
              <Mail size={14} className="text-muted" /> Email each student their target
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run("remove")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13px] font-medium text-ink-2 transition hover:text-ink disabled:opacity-60"
            >
              <Trash2 size={14} /> {busy === "remove" ? "Removing…" : "Remove target"}
            </button>
            <button
              type="button"
              disabled={busy !== null || !canSave}
              onClick={() => void run("save")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-action px-3.5 text-[13px] font-semibold text-white transition hover:bg-action-hover disabled:opacity-60"
            >
              {busy === "save" ? (
                <span className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Check size={14} />
              )}
              {busy === "save" ? "Saving…" : `Set ${test ? "test " : ""}target for ${count}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

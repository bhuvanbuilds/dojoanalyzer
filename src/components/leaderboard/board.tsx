"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, Globe2, Search, Users, X } from "lucide-react";
import { motion } from "motion/react";
import {
  getCurrentUserProfile,
  type CurrentUserProfile,
} from "@/lib/auth/profile";
import { useCachedProfile } from "@/lib/auth/use-cached-profile";
import { formatWeekDateRange } from "@/lib/weeks";
import { LeaderboardExperience } from "@/components/leaderboard/leaderboard-experience";
import type { RankedStudent } from "@/components/leaderboard/types";
import { LanguageLogo } from "@/components/belts/belts";
import { PageState as AccountState } from "@/components/ui/skeleton";
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  type Language,
} from "@/lib/dashboard/metrics";

type Period = {
  key: string;
  academic_year: number;
  week_number: number;
  start_date: string | null;
  end_date: string | null;
};
type University = { id: string; name: string };
type Squad = { id: string; squad_number: string; university_id: string };
type Viewer = {
  student_id: string | null;
  university_id: string | null;
  squad_id: string | null;
};
type Row = {
  rank: number;
  student_id: string;
  student_name: string | null;
  university_name: string | null;
  squad_number: string | null;
  change: number;
  language_belts?: Record<Language, number>;
  total_belts_earned?: number;
  belt_level?: number;
};
type Response = {
  periods?: Period[];
  period?: Period | null;
  universities?: University[];
  squads?: Squad[];
  viewer?: Viewer;
  leaderboard?: Row[];
  error?: string;
};

type Kind = "overall" | "language";

/**
 * Data, filters and page chrome for both leaderboards. Every role sees every
 * university; the scope chips and selects only narrow the view. Filters live
 * in the URL so a filtered board can be shared or bookmarked.
 */
export function LeaderboardBoard({ kind }: { kind: Kind }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cachedProfile = useCachedProfile();
  const [profileState, setProfileState] = useState<
    CurrentUserProfile | { status: "loading" }
  >(cachedProfile ?? { status: "loading" });
  const [data, setData] = useState<Response | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  const universityId = searchParams.get("university") ?? "";
  const squadId = searchParams.get("squad") ?? "";
  const period = searchParams.get("week") ?? "";
  const search = searchParams.get("q") ?? "";
  const language: Language = LANGUAGES.includes(
    searchParams.get("language") as Language,
  )
    ? (searchParams.get("language") as Language)
    : "cpp";
  const [searchInput, setSearchInput] = useState(search);

  function setParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  useEffect(() => {
    let mounted = true;
    getCurrentUserProfile().then((result) => {
      if (mounted) setProfileState(result);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (profileState.status === "unauthenticated") router.replace("/login");
  }, [profileState, router]);

  // Debounce typing into the URL.
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === search) return;
    const timeout = window.setTimeout(() => setParams({ q: trimmed || null }), 300);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParams reads the live URL
  }, [searchInput, search]);

  const requestKey = useMemo(() => {
    const query = new URLSearchParams();
    if (kind === "language") query.set("language", language);
    if (period) query.set("period", period);
    if (universityId) query.set("university_id", universityId);
    if (squadId) query.set("squad_id", squadId);
    if (search) query.set("search", search);
    return `/api/leaderboard/${kind}?${query}`;
  }, [kind, language, period, universityId, squadId, search]);

  const authenticated = profileState.status === "authenticated";
  useEffect(() => {
    if (!authenticated) return;
    const controller = new AbortController();
    fetch(requestKey, { signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as Response;
        if (!response.ok)
          throw new Error(result.error ?? "Unable to load the leaderboard.");
        setData(result);
        setError("");
        setLoadedKey(requestKey);
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError")
          return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load the leaderboard.",
        );
        setLoadedKey(requestKey);
      });
    return () => controller.abort();
  }, [authenticated, requestKey]);

  if (profileState.status === "loading")
    return <AccountState message="Checking your account..." loading />;
  if (profileState.status === "unauthenticated")
    return <AccountState message="Redirecting to login..." loading />;
  if (profileState.status === "unassigned")
    return (
      <AccountState
        message="Account not assigned"
        detail="Your account does not have an assigned profile yet."
      />
    );
  if (profileState.status === "invalid_role")
    return <AccountState message="Account role not supported" />;
  if (profileState.status === "error")
    return (
      <AccountState
        message="Unable to load your account"
        detail={profileState.message}
      />
    );

  if (profileState.status !== "authenticated")
    return <AccountState message="Account role not supported" />;
  const profile = profileState.profile;
  const isStudent = profile.role === "student";
  const isLoading = loadedKey !== requestKey;
  const universities = data?.universities ?? [];
  const squads = data?.squads ?? [];
  const viewer = data?.viewer ?? null;
  const universityName = new Map(universities.map((u) => [u.id, u.name]));
  const squad = squads.find((item) => item.id === squadId) ?? null;
  const scopeLabel = squad
    ? `Squad ${squad.squad_number} · ${universityName.get(squad.university_id) ?? ""}`
    : universityId
      ? (universityName.get(universityId) ?? "University")
      : "All universities";
  const selectedPeriod = data?.period ?? null;
  const weekLabel = selectedPeriod
    ? `Week ${selectedPeriod.week_number}`
    : "latest week";

  const entries: RankedStudent[] = (data?.leaderboard ?? []).map((row) => ({
    rank: row.rank,
    studentId: row.student_id,
    name: row.student_name ?? "Unnamed student",
    squad: row.squad_number,
    university: row.university_name,
    score:
      kind === "overall" ? (row.total_belts_earned ?? 0) : (row.belt_level ?? 0),
    change: row.change,
    languages: row.language_belts,
  }));

  const languageLabel = LANGUAGE_LABELS[language];
  const scopes: Array<{
    id: string;
    label: string;
    icon: typeof Globe2;
    active: boolean;
    apply: Record<string, string | null>;
  }> = [
    {
      id: "all",
      label: "Everyone",
      icon: Globe2,
      active: !universityId && !squadId,
      apply: { university: null, squad: null },
    },
  ];
  if (viewer?.university_id)
    scopes.push({
      id: "campus",
      label: "My campus",
      icon: Building2,
      active: universityId === viewer.university_id && !squadId,
      apply: { university: viewer.university_id, squad: null },
    });
  if (viewer?.squad_id)
    scopes.push({
      id: "squad",
      label: "My squad",
      icon: Users,
      active: squadId === viewer.squad_id,
      apply: { university: viewer.university_id, squad: viewer.squad_id },
    });

  const visibleSquads = universityId
    ? squads.filter((item) => item.university_id === universityId)
    : squads;

  const controls = (
    <div className="space-y-3 bg-surface-2 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        {kind === "language" ? (
          <div
            role="radiogroup"
            aria-label="Language"
            className="flex flex-wrap gap-1 rounded-xl bg-ink/[0.045] p-1"
          >
            {LANGUAGES.map((item) => {
              const active = item === language;
              return (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setParams({ language: item })}
                  className={`relative flex h-8 items-center gap-1.5 rounded-lg px-3 font-display text-[13px] font-semibold transition-colors ${
                    active ? "text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="leaderboard-language"
                      className="absolute inset-0 rounded-lg bg-surface shadow-[var(--card-shadow)] ring-[0.5px] ring-line"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <LanguageLogo language={item} size={16} className="relative" />
                  <span className="relative">{LANGUAGE_LABELS[item]}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div
          role="radiogroup"
          aria-label="Scope"
          className="flex gap-1 rounded-xl bg-ink/[0.045] p-1"
        >
          {scopes.map((scope) => (
            <button
              key={scope.id}
              type="button"
              role="radio"
              aria-checked={scope.active}
              onClick={() => setParams(scope.apply)}
              className={`relative flex h-8 items-center gap-1.5 rounded-lg px-3 font-display text-[13px] font-semibold transition-colors ${
                scope.active ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {scope.active ? (
                <motion.span
                  layoutId={`leaderboard-scope-${kind}`}
                  className="absolute inset-0 rounded-lg bg-surface shadow-[var(--card-shadow)] ring-[0.5px] ring-line"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <scope.icon size={14} className="relative" />
              <span className="relative">{scope.label}</span>
            </button>
          ))}
        </div>

        <span className="ml-auto hidden text-[12.5px] text-muted md:inline">
          {isLoading ? "Updating…" : `${entries.length} ranked`}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,220px))_minmax(0,1fr)]">
        <SelectBox
          label="University"
          value={universityId}
          onChange={(value) => setParams({ university: value || null, squad: null })}
        >
          <option value="">All universities</option>
          {universities.map((university) => (
            <option key={university.id} value={university.id}>
              {university.name}
            </option>
          ))}
        </SelectBox>
        <SelectBox
          label="Squad"
          value={squadId}
          onChange={(value) => {
            const picked = squads.find((item) => item.id === value);
            setParams({
              squad: value || null,
              university: picked ? picked.university_id : universityId || null,
            });
          }}
        >
          <option value="">All squads</option>
          {visibleSquads.map((item) => (
            <option key={item.id} value={item.id}>
              Squad {item.squad_number}
              {universityId
                ? ""
                : ` · ${universityName.get(item.university_id) ?? ""}`}
            </option>
          ))}
        </SelectBox>
        <SelectBox
          label="Week"
          value={period}
          onChange={(value) => setParams({ week: value || null })}
        >
          <option value="">Latest week</option>
          {(data?.periods ?? []).map((item) => (
            <option key={item.key} value={item.key}>
              Week {item.week_number} · {item.academic_year} ·{" "}
              {formatWeekDateRange(item.start_date, item.end_date)}
            </option>
          ))}
        </SelectBox>
        <label className="relative flex items-center">
          <span className="sr-only">Search</span>
          <Search
            size={15}
            className="pointer-events-none absolute left-3 text-faint"
          />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name, campus or squad…"
            className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-9 text-[14px] text-ink outline-none transition placeholder:text-faint hover:border-line-strong focus-visible:ring-2 focus-visible:ring-ink/10"
          />
          {searchInput ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchInput("")}
              className="absolute right-2 grid h-6 w-6 place-items-center rounded-md text-muted hover:text-ink"
            >
              <X size={14} />
            </button>
          ) : null}
        </label>
      </div>
    </div>
  );

  return (
    <LeaderboardExperience
      eyebrow={`${kind === "overall" ? "Overall" : languageLabel} · ${scopeLabel} · ${weekLabel}`}
      title={
        kind === "overall"
          ? squad
            ? `Squad ${squad.squad_number} Champions`
            : "Kalvium Dojo Champions"
          : `${languageLabel} Black Belts`
      }
      subtitle={
        kind === "overall"
          ? "Students ranked by total belts across every language."
          : `Students ranked by their ${languageLabel} belt level.`
      }
      entries={entries}
      scoreLabel={kind === "overall" ? "belts" : "level"}
      language={kind === "language" ? language : undefined}
      isLoading={isLoading}
      error={error}
      currentStudentId={isStudent ? profile.student_id : null}
      linkStudents={!isStudent}
      emptyMessage={
        search || universityId || squadId
          ? "No students match these filters."
          : "No belt data has been imported yet."
      }
      controls={controls}
    />
  );
}

function SelectBox({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative flex min-w-0 items-center rounded-xl border border-line bg-surface transition hover:border-line-strong focus-within:ring-2 focus-within:ring-ink/10">
      <span className="pointer-events-none pl-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 min-w-0 flex-1 cursor-pointer appearance-none truncate bg-transparent pl-2 pr-8 text-[13.5px] font-semibold text-ink outline-none"
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute right-3 h-3 w-3 text-muted"
      >
        <path
          d="M4 6l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </label>
  );
}

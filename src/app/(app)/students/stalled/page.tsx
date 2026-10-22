"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Search, X } from "lucide-react";
import {
  getCurrentUserProfile,
  type CurrentUserProfile,
} from "@/lib/auth/profile";
import { useCachedProfile } from "@/lib/auth/use-cached-profile";
import { loadOverview, overviewQuery } from "@/lib/dashboard/load-overview";
import {
  LANGUAGES,
  buildModel,
  stalledStudents,
  sum,
  type DashboardData,
} from "@/lib/dashboard/metrics";
import { useUrlFilters } from "@/lib/use-url-filters";
import { studentHref } from "@/lib/student-links";
import { PageState } from "@/components/ui/skeleton";
import { Frame, FrameMessage, FrameTitle, Page } from "@/components/ui/frame";
import { StudentAvatar } from "@/components/students/avatar";
import { BeltBadge } from "@/components/belts/belts";
import { PillSelect } from "@/components/insights/kit";

const SPAN = 3;

export default function StalledStudentsPage() {
  return (
    <Suspense fallback={<PageState message="Loading stalled students" loading />}>
      <StalledStudents />
    </Suspense>
  );
}

function StalledStudents() {
  const router = useRouter();
  const cachedProfile = useCachedProfile();
  const [profileState, setProfileState] = useState<
    CurrentUserProfile | { status: "loading" }
  >(cachedProfile ?? { status: "loading" });
  const [filters, setFilters] = useUrlFilters({
    academicYear: "",
    university: "",
    week: "",
    squad: "",
    q: "",
  });
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

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
    if (profileState.status === "authenticated" && profileState.profile.role === "student")
      router.replace("/student");
  }, [profileState, router]);

  const query = overviewQuery(filters.academicYear, filters.university);
  useEffect(() => {
    if (profileState.status !== "authenticated") return;
    let active = true;
    loadOverview(query)
      .then((result) => {
        if (active) {
          setData(result);
          setError("");
        }
      })
      .catch((loadError: unknown) => {
        if (active)
          setError(loadError instanceof Error ? loadError.message : "Unable to load students.");
      });
    return () => {
      active = false;
    };
  }, [profileState.status, query]);

  const model = useMemo(() => (data ? buildModel(data) : null), [data]);
  const week =
    model && model.weekNumbers.includes(Number(filters.week))
      ? Number(filters.week)
      : (model?.weekNumbers.at(-1) ?? null);

  const rows = useMemo(() => {
    if (!model || week === null) return [];
    const term = filters.q.trim().toLowerCase();
    return stalledStudents(model, week, SPAN)
      .map((id) => {
        const byWeek = model.levels.get(id)!;
        const recorded = [...byWeek.keys()]
          .filter((w) => w <= week)
          .sort((a, b) => a - b)
          .slice(-SPAN);
        return {
          id,
          name: model.studentName.get(id) ?? "Unknown student",
          squadId: model.studentSquad.get(id) ?? "",
          levels: byWeek.get(week) ?? [],
          recent: recorded.map((w) => ({ week: w, total: sum(byWeek.get(w) ?? []) })),
        };
      })
      .filter(
        (row) =>
          (!filters.squad || row.squadId === filters.squad) &&
          (!term || row.name.toLowerCase().includes(term)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [model, week, filters.q, filters.squad]);

  if (profileState.status === "loading") return <PageState message="Checking your account" loading />;
  if (profileState.status !== "authenticated")
    return <PageState message="Redirecting" loading />;
  if (error) return <PageState message="Couldn’t load stalled students" detail={error} />;
  if (!model) return <PageState message="Loading stalled students" loading />;
  if (week === null)
    return (
      <PageState
        message="No belt data yet"
        detail="Upload a weekly belt CSV and stalled students will show up here."
      />
    );

  const squads = [...new Set(model.data.students.map((s) => s.squad_id))]
    .filter(Boolean)
    .map((id) => ({ id, label: model.squadLabel.get(id) ?? "Squad" }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const backHref = `/?${new URLSearchParams(
    Object.entries({
      academicYear: filters.academicYear,
      university: filters.university,
      week: filters.week,
    }).filter(([, value]) => value),
  )}`;

  return (
    <Page>
      <Frame>
        <FrameTitle
          eyebrow={
            <Link href={backHref} className="inline-flex items-center gap-1 hover:underline">
              <ArrowLeft size={12} /> Dashboard · Needs attention
            </Link>
          }
          title={`${rows.length} stalled ${rows.length === 1 ? "student" : "students"}`}
          description={`No belt gained across their last ${SPAN} tests, as of Week ${week}. Open a student to see their full history.`}
          actions={
            <>
              <PillSelect
                label="Week"
                value={String(week)}
                onChange={(value) => setFilters({ week: value })}
              >
                {model.weekNumbers.map((w) => (
                  <option key={w} value={w}>
                    Week {w}
                  </option>
                ))}
              </PillSelect>
              <PillSelect
                label="Squad"
                value={filters.squad}
                onChange={(value) => setFilters({ squad: value })}
              >
                <option value="">All</option>
                {squads.map((squad) => (
                  <option key={squad.id} value={squad.id}>
                    {squad.label}
                  </option>
                ))}
              </PillSelect>
              <label className="relative">
                <span className="sr-only">Search students</span>
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
                />
                <input
                  value={filters.q}
                  onChange={(event) => setFilters({ q: event.target.value }, { replace: true })}
                  placeholder="Search a name"
                  className="w-52 rounded-xl border border-transparent bg-sunken py-2 pl-8 pr-7 text-[13px] outline-none focus:border-line-strong focus:bg-surface"
                />
                {filters.q ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setFilters({ q: "" })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                  >
                    <X size={13} />
                  </button>
                ) : null}
              </label>
            </>
          }
        />
        {rows.length === 0 ? (
          <FrameMessage title="Nobody is stalled here">
            Every student in this view gained a belt within their last {SPAN} tests.
          </FrameMessage>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={studentHref(row.id)}
                  className="group flex items-center gap-4 px-4 py-3 transition hover:bg-surface-2 sm:px-5"
                >
                  <StudentAvatar id={row.id} name={row.name} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[14.5px] font-semibold text-ink group-hover:underline">
                      {row.name}
                    </span>
                    <span className="block truncate text-[12.5px] text-muted">
                      {model.squadLabel.get(row.squadId) ?? "No squad"} · last {SPAN} tests:{" "}
                      {row.recent.map((item) => `W${item.week} ${item.total}`).join(" → ")}
                    </span>
                  </span>
                  <span className="hidden gap-1 md:flex">
                    {LANGUAGES.map((language, index) => (
                      <BeltBadge key={language} language={language} level={row.levels[index] ?? 0} />
                    ))}
                  </span>
                  <span className="w-16 text-right font-display text-[16px] font-bold tabular-nums">
                    {sum(row.levels)}
                    <span className="ml-1 text-[11px] font-normal text-muted">belts</span>
                  </span>
                  <ChevronRight
                    size={16}
                    className="text-faint transition group-hover:translate-x-0.5 group-hover:text-ink"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Frame>
    </Page>
  );
}

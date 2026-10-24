"use client";

import {
  ArrowUpRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  Minus,
  MinusCircle,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { CountUp } from "@/components/reactbits/count-up";
import { useStudentOpener } from "@/components/dashboard/student-opener";
import {
  LANGUAGE_COLORS,
  ViewSelect,
  formatNumber,
} from "@/components/dashboard/chart-kit";
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  groupsFor,
  rangeProgress,
  sum,
  type GroupBy,
  type Model,
  type RangeStatus,
  type StudentRange,
} from "@/lib/dashboard/metrics";

type SortKey = "gain" | "end" | "name";
type StatusFilter = "all" | "improved" | "same" | "untested";

const STATUS_LABEL: Record<RangeStatus, string> = {
  improved: "Improved",
  same: "No change",
  untested: "Not tested",
  no_data: "No data",
};

const PAGE = 12;

/** Belts gained between any two weeks, with a per-student breakdown. */
export function RangeExplorer({ model, week }: { model: Model; week: number }) {
  const weeks = model.weekNumbers;
  const [from, setFrom] = useState(weeks[0] ?? week);
  const [to, setTo] = useState(week);
  const [scope, setScope] = useState("overall:all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("gain");
  const [page, setPage] = useState(0);

  const canSplitUniversity =
    model.data.role === "super_admin" && model.multiUniversity;
  const scopeOptions = [
    { value: "overall:all", label: "All students" },
    ...groupsFor(model, "squad").map((group) => ({
      value: `squad:${group.key}`,
      label: group.label,
    })),
    ...(canSplitUniversity
      ? groupsFor(model, "university").map((group) => ({
          value: `university:${group.key}`,
          label: group.label,
        }))
      : []),
  ];
  const [scopeGroup, scopeKey] = scope.split(":") as [GroupBy, string];
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  const range = useMemo(
    () => rangeProgress(model, low, high, scopeGroup, scopeKey),
    [model, low, high, scopeGroup, scopeKey],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return range.students
      .filter((student) =>
        status === "all"
          ? true
          : status === "untested"
            ? student.status === "untested" || student.status === "no_data"
            : student.status === status,
      )
      .filter(
        (student) => !needle || student.name.toLowerCase().includes(needle),
      )
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "end") return sum(b.end ?? []) - sum(a.end ?? []);
        return b.gain - a.gain || sum(b.end ?? []) - sum(a.end ?? []);
      });
  }, [range, query, status, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE, current * PAGE + PAGE);
  const endIndex = weeks.indexOf(week);
  const activePreset =
    high !== week ? null : low === weeks[0] ? "all" : low === weeks[Math.max(0, endIndex - 4)] ? 4 : low === weeks[Math.max(0, endIndex - 1)] ? 1 : null;
  const maxLanguageGain = Math.max(1, ...range.languageGain.map(Math.abs));

  function preset(span: number | "all") {
    const endIndex = weeks.indexOf(week);
    const startIndex = span === "all" ? 0 : Math.max(0, endIndex - span);
    setFrom(weeks[startIndex]);
    setTo(week);
    setPage(0);
  }

  function exportCsv() {
    const header = [
      "Student",
      "Squad",
      "Start week",
      "Start belts",
      "End week",
      "End belts",
      "Gain",
      ...LANGUAGES.map((language) => `${LANGUAGE_LABELS[language]} gain`),
      "Tests in range",
      "Status",
    ];
    const lines = rows.map((student) =>
      [
        student.name,
        model.squadLabel.get(student.squadId) ?? "",
        student.startWeek ?? "",
        student.start ? sum(student.start) : "",
        student.endWeek ?? "",
        student.end ? sum(student.end) : "",
        student.gain,
        ...student.languageGain,
        student.tests,
        STATUS_LABEL[student.status],
      ]
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `belt-progress-week-${low}-to-${high}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const stats = [
    {
      label: "Belts gained",
      value: range.beltsGained,
      prefix: range.beltsGained > 0 ? "+" : "",
      detail: `Week ${low} → Week ${high}`,
      icon: BarChart3,
    },
    {
      label: "Students improved",
      value: range.improved,
      detail: `of ${range.tested} tested in range`,
      icon: Users,
    },
    {
      label: "Avg gain per student",
      value: range.avgGain ?? 0,
      decimals: 2,
      prefix: (range.avgGain ?? 0) > 0 ? "+" : "",
      detail: "Across students tested in range",
      icon: TrendingUp,
    },
    {
      label: "No change",
      value: range.same,
      detail: `${range.untested} not tested in range`,
      icon: MinusCircle,
    },
  ];

  return (
    <section data-tour="range" className="min-w-0">
      {/* Header & range controls */}
      <div className="flex flex-col gap-4 px-5 pb-5 pt-6 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-ink">Progress between weeks</h2>
          <p className="mt-0.5 text-[13px] text-muted">Belts each student gained from one week to another.</p>
        </div>
        <div data-tour="range-controls" className="flex flex-wrap items-center gap-2.5">
          <div className="flex rounded-lg bg-sunken p-0.5">
            {(
              [
                ["Last week", 1],
                ["Last 4 weeks", 4],
                ["Whole year", "all"],
              ] as const
            ).map(([label, span]) => (
              <button
                key={label}
                type="button"
                aria-pressed={activePreset === span}
                onClick={() => preset(span)}
                className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium transition ${
                  activePreset === span
                    ? "bg-surface text-ink shadow-[var(--card-shadow)] ring-[0.5px] ring-line"
                    : "text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <ViewSelect
            label="From"
            value={String(from)}
            options={weeks.map((item) => ({ value: String(item), label: `Week ${item}` }))}
            onChange={(value) => {
              setFrom(Number(value));
              setPage(0);
            }}
          />
          <ViewSelect
            label="To"
            value={String(to)}
            options={weeks.map((item) => ({ value: String(item), label: `Week ${item}` }))}
            onChange={(value) => {
              setTo(Number(value));
              setPage(0);
            }}
          />
          <ViewSelect
            label="Scope"
            value={scope}
            options={scopeOptions}
            onChange={(value) => {
              setScope(value);
              setPage(0);
            }}
          />
        </div>
      </div>

      {/* Totals */}
      <dl
        data-tour="range-stats"
        className="mx-5 grid border-y border-line sm:mx-6 sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-line"
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex items-start justify-between gap-3 py-4 xl:px-5 xl:first:pl-0">
              <div className="min-w-0">
                <dt className="text-[13px] text-muted">{stat.label}</dt>
                <dd className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink tabular-nums">
                  <CountUp
                    key={`${low}-${high}-${scope}-${stat.value}`}
                    to={stat.value}
                    decimals={stat.decimals ?? 0}
                    prefix={stat.prefix}
                  />
                </dd>
                <dd className="mt-0.5 text-[12.5px] text-muted">{stat.detail}</dd>
              </div>
              <Icon size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-faint" aria-hidden="true" />
            </div>
          );
        })}
      </dl>

      {/* Per-language gains */}
      <div data-tour="range-languages" className="grid gap-x-8 gap-y-4 px-5 py-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
        {LANGUAGES.map((language, index) => {
          const value = range.languageGain[index];
          return (
            <div key={language}>
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2 text-ink-2">
                  <span className="size-2.5 rounded-full" style={{ background: LANGUAGE_COLORS[language] }} aria-hidden="true" />
                  {LANGUAGE_LABELS[language]}
                </span>
                <span className="font-semibold tabular-nums text-ink">
                  {value > 0 ? "+" : ""}
                  {value}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken">
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{
                    width: `${(Math.abs(value) / maxLanguageGain) * 100}%`,
                    background: LANGUAGE_COLORS[language],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Student table controls */}
      <div data-tour="range-list" className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Search students</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              placeholder="Search students…"
              className="h-9 w-64 rounded-lg border border-line-strong bg-surface pl-9 pr-3 text-[13px] text-ink outline-none transition placeholder:text-faint focus-visible:ring-2 focus-visible:ring-ink/10"
            />
          </label>
          <div className="flex rounded-lg bg-sunken p-0.5">
            {(
              [
                ["all", "All"],
                ["improved", "Improved"],
                ["same", "No change"],
                ["untested", "Not tested"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={status === value}
                onClick={() => {
                  setStatus(value);
                  setPage(0);
                }}
                className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium transition ${
                  status === value
                    ? "bg-surface text-ink shadow-[var(--card-shadow)] ring-[0.5px] ring-line"
                    : "text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <ViewSelect
            label="Sort"
            value={sort}
            options={[
              { value: "gain", label: "Most gained" },
              { value: "end", label: "Most belts" },
              { value: "name", label: "Name" },
            ]}
            onChange={setSort}
          />
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong px-3 text-[13px] font-medium text-ink-2 transition hover:border-ink/30 hover:text-ink"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Student table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-[13.5px]">
          <thead className="text-[12px] text-muted">
            <tr className="border-y border-line">
              <th className="px-5 py-2.5 font-medium sm:px-6">Student</th>
              <th className="px-4 py-2.5 font-medium">Start</th>
              <th className="px-4 py-2.5 font-medium">End</th>
              <th className="px-4 py-2.5 font-medium">Gain</th>
              <th className="px-4 py-2.5 font-medium">By language</th>
              <th className="px-5 py-2.5 text-right font-medium sm:px-6">Tests</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-muted">
                  No students match.
                </td>
              </tr>
            ) : (
              visible.map((student) => (
                <StudentRow
                  key={student.studentId}
                  student={student}
                  squad={model.squadLabel.get(student.squadId) ?? "—"}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 text-[12.5px] text-muted sm:px-6">
        <span>
          Showing {visible.length} of {rows.length} students
        </span>
        {pages > 1 ? <Pager page={current} pages={pages} onPage={setPage} /> : null}
      </div>
    </section>
  );
}

/** Compact numbered pager: 1 2 3 4 5 … 10 with previous/next. */
function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  const items: Array<number | "gap"> = [];
  for (let index = 0; index < pages; index += 1) {
    if (index === 0 || index === pages - 1 || Math.abs(index - page) <= 2 || (page < 4 && index < 5)) items.push(index);
    else if (items.at(-1) !== "gap") items.push("gap");
  }
  const button = "grid h-8 min-w-8 place-items-center rounded-lg border px-2 text-[12.5px] tabular-nums transition";
  return (
    <nav aria-label="Pages" className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Previous page"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
        className={`${button} border-line text-ink-2 hover:text-ink disabled:opacity-40`}
      >
        <ChevronLeft size={14} />
      </button>
      {items.map((item, index) =>
        item === "gap" ? (
          <span key={`gap-${index}`} className="px-1 text-faint">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            aria-current={item === page ? "page" : undefined}
            onClick={() => onPage(item)}
            className={`${button} ${item === page ? "border-ink/40 bg-sunken text-ink" : "border-line text-ink-2 hover:text-ink"}`}
          >
            {item + 1}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pages - 1}
        onClick={() => onPage(page + 1)}
        className={`${button} border-line text-ink-2 hover:text-ink disabled:opacity-40`}
      >
        <ChevronRight size={14} />
      </button>
    </nav>
  );
}

function StudentRow({
  student,
  squad,
}: {
  student: StudentRange;
  squad: string;
}) {
  const { openStudent } = useStudentOpener();
  const start = student.start ? sum(student.start) : null;
  const end = student.end ? sum(student.end) : null;
  const changed = LANGUAGES.map((language, index) => ({
    language,
    value: student.languageGain[index],
  })).filter((item) => item.value !== 0);

  return (
    <tr className="transition-colors hover:bg-sunken/50">
      <td className="px-5 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => openStudent(student.studentId)}
          className="text-left font-medium text-ink hover:underline"
        >
          {student.name}
        </button>
        <span className="block text-[12px] text-muted">
          {squad}
          {student.joinedInRange && " · first test in range"}
        </span>
      </td>
      <td className="px-4 py-3 tabular-nums text-ink-2">
        {start === null ? (
          "—"
        ) : (
          <>
            {start}
            <span className="ml-1 text-[11.5px] text-faint">
              W{student.startWeek}
            </span>
          </>
        )}
      </td>
      <td className="px-4 py-3 tabular-nums text-ink-2">
        {end === null ? (
          "—"
        ) : (
          <>
            {end}
            <span className="ml-1 text-[11.5px] text-faint">
              W{student.endWeek}
            </span>
          </>
        )}
      </td>
      <td className="px-4 py-3">
        {student.status === "untested" || student.status === "no_data" ? (
          <span className="text-[12.5px] text-faint">
            {STATUS_LABEL[student.status]}
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12.5px] font-semibold tabular-nums ${
              student.gain > 0
                ? "bg-success-soft text-success-text"
                : "bg-ink/[0.05] text-muted"
            }`}
          >
            {student.gain > 0 ? <ArrowUpRight size={13} /> : <Minus size={13} />}
            {student.gain}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        {changed.length === 0 ? (
          <span className="text-[12.5px] text-faint">—</span>
        ) : (
          <span className="flex flex-wrap gap-1.5">
            {changed.map((item) => (
              <span
                key={item.language}
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-0.5 text-[12px] text-ink-2"
              >
                <span className="size-2 rounded-full" style={{ background: LANGUAGE_COLORS[item.language] }} aria-hidden="true" />
                {LANGUAGE_LABELS[item.language]}
                <span className="font-semibold tabular-nums text-ink">
                  {item.value > 0 ? "+" : ""}
                  {item.value}
                </span>
              </span>
            ))}
          </span>
        )}
      </td>
      <td className="px-5 py-3 text-right tabular-nums text-muted sm:px-6">
        {formatNumber(student.tests)}
      </td>
    </tr>
  );
}

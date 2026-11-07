"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search, Upload } from "lucide-react";
import { getCurrentUserProfile, type CurrentUserProfile } from "@/lib/auth/profile";
import { useCachedProfile } from "@/lib/auth/use-cached-profile";
import { Frame, FrameTitle, Page } from "@/components/ui/frame";
import { Dropdown } from "@/components/ui/dropdown";
import { FormBanner } from "@/components/ui/form";
import { PanelSkeleton } from "@/components/ui/skeleton";
import { LeetCodeCardView } from "@/components/leetcode/leetcode-card";
import { cardStatus, istDay, type CardStatus, type LeetCodeCard } from "@/lib/leetcode";

type University = { id: string; name: string };
type Sort = "status" | "today" | "streak" | "total" | "name";
const STATUS_ORDER: Record<CardStatus, number> = { pending: 0, solved: 1, missing: 2 };

/** Staff view: who solved LeetCode problems today, as colour-coded cards. */
export default function LeetCodeTrackerPage() {
  const cachedProfile = useCachedProfile();
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
  const account = loadedProfile ?? cachedProfile;
  const isSuperAdmin = account?.status === "authenticated" && account.profile.role === "super_admin";
  const profileReady = account?.status === "authenticated";

  const [today] = useState(() => istDay());
  const [universities, setUniversities] = useState<University[]>([]);
  const [universityId, setUniversityId] = useState("");
  const [cards, setCards] = useState<LeetCodeCard[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [squad, setSquad] = useState("all");
  const [status, setStatus] = useState<"all" | CardStatus>("all");
  const [sort, setSort] = useState<Sort>("status");
  const fileInput = useRef<HTMLInputElement>(null);

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

  const load = useCallback(
    (sync: boolean): Promise<void> => {
      if (!profileReady || (isSuperAdmin && !universityId)) return Promise.resolve();
      const query = new URLSearchParams();
      if (isSuperAdmin) query.set("university_id", universityId);
      if (sync) query.set("sync", "1");
      return fetch(`/api/leetcode?${query}`, { cache: "no-store" })
        .then(async (response) => {
          const result = (await response.json()) as { cards?: LeetCodeCard[]; error?: string };
          if (!response.ok) throw new Error(result.error ?? "Couldn’t load the tracker.");
          setCards(result.cards ?? []);
          setError("");
        })
        .catch((loadError) => {
          setCards((current) => current ?? []);
          setError(loadError instanceof Error ? loadError.message : "Couldn’t load the tracker.");
        });
    },
    [profileReady, isSuperAdmin, universityId],
  );

  // Show what's stored right away, then refresh from LeetCode in the background.
  useEffect(() => {
    void load(false)
      .then(() => {
        setSyncing(true);
        return load(true);
      })
      .finally(() => setSyncing(false));
  }, [load]);

  function refresh() {
    setSyncing(true);
    void load(true).finally(() => setSyncing(false));
  }

  const squads = useMemo(() => {
    const map = new Map<string, string>();
    for (const card of cards ?? []) map.set(card.squad_number, card.squad_number);
    return [...map.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [cards]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = (cards ?? [])
      .filter((card) => !needle || card.name.toLowerCase().includes(needle) || card.username?.toLowerCase().includes(needle))
      .filter((card) => squad === "all" || card.squad_number === squad)
      .filter((card) => status === "all" || cardStatus(card) === status);
    const byName = (a: LeetCodeCard, b: LeetCodeCard) => a.name.localeCompare(b.name);
    const sorters: Record<Sort, (a: LeetCodeCard, b: LeetCodeCard) => number> = {
      status: (a, b) => STATUS_ORDER[cardStatus(a)] - STATUS_ORDER[cardStatus(b)] || byName(a, b),
      today: (a, b) => b.solved_today - a.solved_today || byName(a, b),
      streak: (a, b) => (b.leetcode_streak ?? -1) - (a.leetcode_streak ?? -1) || byName(a, b),
      total: (a, b) => (b.total_solved ?? -1) - (a.total_solved ?? -1) || byName(a, b),
      name: byName,
    };
    return list.sort(sorters[sort]);
  }, [cards, search, squad, status, sort]);

  const counts = useMemo(() => {
    const all = cards ?? [];
    return {
      solved: all.filter((card) => cardStatus(card) === "solved").length,
      pending: all.filter((card) => cardStatus(card) === "pending").length,
      missing: all.filter((card) => cardStatus(card) === "missing").length,
      problems: all.reduce((sum, card) => sum + card.solved_today, 0),
    };
  }, [cards]);

  async function saveUsername(studentId: string, username: string) {
    const response = await fetch("/api/leetcode", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, username }),
    });
    const result = (await response.json()) as { card?: LeetCodeCard; error?: string };
    if (!response.ok || !result.card) throw new Error(result.error ?? "Couldn’t save the username.");
    setCards((current) => (current ?? []).map((card) => (card.student_id === studentId ? result.card! : card)));
  }

  async function importCsv(file: File) {
    setNotice("");
    setError("");
    try {
      const csv = await file.text();
      const response = await fetch("/api/leetcode/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, universityId: isSuperAdmin ? universityId : undefined }),
      });
      const result = (await response.json()) as { linked?: number; problems?: string[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Couldn’t import the file.");
      setNotice(
        `Linked ${result.linked} LeetCode account${result.linked === 1 ? "" : "s"}.${
          result.problems?.length ? ` Skipped ${result.problems.length}: ${result.problems.slice(0, 3).join("; ")}${result.problems.length > 3 ? "…" : ""}` : ""
        }`,
      );
      await load(false);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Couldn’t import the file.");
    }
  }

  return (
    <Page>
      <div data-tour="lc-tracker">
      <Frame>
        <FrameTitle
          eyebrow="Insights"
          title="LeetCode tracker"
          description="Who solved a new LeetCode problem today (12 am to 12 am IST). Green cards solved at least one new problem today, red ones haven’t yet. Re-solving an old problem doesn’t count."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {isSuperAdmin ? (
                <Dropdown
                  chevron
                  aria-label="University"
                  value={universityId}
                  onChange={(value) => {
                    setCards(null);
                    setUniversityId(value);
                  }}
                  className="h-9 min-w-[160px] rounded-lg border border-line-strong bg-surface px-3 text-[13px]"
                >
                  {universities.map((university) => (
                    <option key={university.id} value={university.id}>
                      {university.name}
                    </option>
                  ))}
                </Dropdown>
              ) : null}
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importCsv(file);
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                title="CSV with columns: email, leetcode_username"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink-2 hover:text-ink"
              >
                <Upload size={14} /> Import usernames
              </button>
              <button
                type="button"
                disabled={syncing}
                onClick={refresh}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink-2 hover:text-ink disabled:opacity-60"
              >
                <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing…" : "Refresh"}
              </button>
            </div>
          }
        />

        <div className="grid border-b border-line sm:grid-cols-4 sm:divide-x sm:divide-line">
          {(
            [
              ["Solved today", counts.solved, "text-emerald-600 dark:text-emerald-400", "solved"],
              ["Not yet today", counts.pending, "text-red-600 dark:text-red-400", "pending"],
              ["Not linked", counts.missing, "text-ink", "missing"],
              ["Problems today", counts.problems, "text-ink", null],
            ] as const
          ).map(([label, value, tone, filter]) => (
            <button
              key={label}
              type="button"
              disabled={!filter}
              onClick={() => filter && setStatus((current) => (current === filter ? "all" : filter))}
              className={`px-5 py-4 text-left transition ${filter ? "hover:bg-sunken/50" : ""} ${status === filter ? "bg-sunken" : ""}`}
            >
              <p className="text-[12.5px] text-muted">{label}</p>
              <p className={`mt-0.5 text-[24px] font-semibold tracking-[-0.02em] tabular-nums ${tone}`}>{value}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-surface-2 px-4 py-3 sm:px-5">
          <label className="flex h-9 min-w-52 flex-1 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3">
            <Search size={15} className="text-muted" />
            <span className="sr-only">Search students</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or LeetCode username"
              className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-faint"
            />
          </label>
          <Dropdown chevron aria-label="Squad" value={squad} onChange={setSquad} className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-[13px]">
            <option value="all">All squads</option>
            {squads.map((number) => (
              <option key={number} value={number}>
                Squad {number}
              </option>
            ))}
          </Dropdown>
          <Dropdown
            chevron
            aria-label="Status"
            value={status}
            onChange={(value) => setStatus(value as typeof status)}
            className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-[13px]"
          >
            <option value="all">Any status</option>
            <option value="solved">Solved today</option>
            <option value="pending">Not solved today</option>
            <option value="missing">No LeetCode linked</option>
          </Dropdown>
          <Dropdown chevron aria-label="Sort" value={sort} onChange={(value) => setSort(value as Sort)} className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-[13px]">
            <option value="status">Sort: not solved first</option>
            <option value="today">Sort: most solved today</option>
            <option value="streak">Sort: longest streak</option>
            <option value="total">Sort: most solved overall</option>
            <option value="name">Sort: name</option>
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

        {cards === null ? (
          <PanelSkeleton rows={6} label="Loading students" flat />
        ) : visible.length === 0 ? (
          <p className="px-6 py-12 text-center text-[13.5px] text-muted">No students match.</p>
        ) : (
          <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
            {visible.map((card, index) => (
              <LeetCodeCardView
                key={card.student_id}
                card={card}
                today={today}
                index={index}
                showCampus={isSuperAdmin}
                onSaveUsername={(username) => saveUsername(card.student_id, username)}
              />
            ))}
          </div>
        )}
      </Frame>
      </div>
    </Page>
  );
}

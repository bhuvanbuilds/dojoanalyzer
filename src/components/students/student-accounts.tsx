"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Mail, Pencil, X } from "lucide-react";
import { LanguageLogo } from "@/components/belts/belts";
import { LeetCodeLogo } from "@/components/leetcode/leetcode-logo";
import { FormBanner } from "@/components/ui/form";

type Lang = "cpp" | "java" | "nodejs" | "python";
type Accounts = {
  primary_language: Lang | null;
  secondary_language: Lang | null;
  personal_email?: string | null;
  leetcode: string | null;
  github: string | null;
  linkedin: string | null;
  codechef: string | null;
  canEdit: boolean;
};
const LABELS: Record<Lang, string> = { cpp: "C++", java: "Java", nodejs: "Node.js", python: "Python" };

/** Primary / secondary language and linked accounts on a student's profile; staff can edit. */
export function StudentAccounts({ studentId }: { studentId: string }) {
  const [data, setData] = useState<Accounts | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/students/${studentId}/accounts`, { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<Accounts>) : null))
      .then((result) => active && setData(result))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [studentId]);

  if (!data) return null;

  function startEdit() {
    setDraft({
      primary_language: data!.primary_language ?? "",
      secondary_language: data!.secondary_language ?? "",
      personal_email: data!.personal_email ?? "",
      leetcode: data!.leetcode ?? "",
      github: data!.github ?? "",
      linkedin: data!.linkedin ?? "",
      codechef: data!.codechef ?? "",
    });
    setError("");
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/students/${studentId}/accounts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = (await response.json()) as Accounts & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Couldn’t save.");
      setData(result);
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn’t save.");
    } finally {
      setSaving(false);
    }
  }

  const links = [
    data.leetcode ? { label: data.leetcode, href: `https://leetcode.com/u/${data.leetcode}/`, icon: <LeetCodeLogo size={13} /> } : null,
    data.github ? { label: "GitHub", href: data.github, icon: null } : null,
    data.linkedin ? { label: "LinkedIn", href: data.linkedin, icon: null } : null,
    data.codechef ? { label: "CodeChef", href: data.codechef, icon: null } : null,
  ].filter(Boolean) as Array<{ label: string; href: string; icon: React.ReactNode }>;

  const lang = (key: "primary_language" | "secondary_language", label: string) => {
    const value = data[key];
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-[12.5px]">
        <span className="text-muted">{label}</span>
        {value ? (
          <>
            <LanguageLogo language={value} size={14} />
            <span className="font-semibold text-ink">{LABELS[value]}</span>
          </>
        ) : (
          <span className="text-faint">not set</span>
        )}
      </span>
    );
  };

  const field = (key: string, label: string, placeholder: string) => (
    <label className="flex min-w-0 flex-col gap-1 text-[11.5px] font-medium text-ink-2">
      {label}
      <input
        value={draft[key] ?? ""}
        onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
        placeholder={placeholder}
        className="h-8 rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] outline-none focus:border-ink"
      />
    </label>
  );
  const select = (key: string, label: string) => (
    <label className="flex flex-col gap-1 text-[11.5px] font-medium text-ink-2">
      {label}
      <select
        value={draft[key] ?? ""}
        onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
        className="h-8 rounded-lg border border-line-strong bg-surface px-2 text-[13px]"
      >
        <option value="">Not set</option>
        {(Object.keys(LABELS) as Lang[]).map((key2) => (
          <option key={key2} value={key2}>
            {LABELS[key2]}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="border-b border-line px-4 py-3 sm:px-5">
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="flex flex-col gap-3"
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {select("primary_language", "Primary language")}
            {select("secondary_language", "Secondary language")}
            {field("personal_email", "Personal email", "name@gmail.com")}
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            {field("leetcode", "LeetCode", "username or profile link")}
            {field("github", "GitHub", "github.com/username")}
            {field("linkedin", "LinkedIn", "linkedin.com/in/…")}
            {field("codechef", "CodeChef", "codechef.com/users/…")}
          </div>
          {error ? <FormBanner tone="error">{error}</FormBanner> : null}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="h-8 rounded-lg bg-ink px-3 text-[12.5px] font-semibold text-page disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] text-muted hover:text-ink">
              <X size={13} /> Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {lang("primary_language", "Primary")}
          {lang("secondary_language", "Secondary")}
          {data.personal_email ? (
            <span className="inline-flex items-center gap-1 text-[12px] text-muted">
              <Mail size={12} /> {data.personal_email}
            </span>
          ) : null}
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[12px] text-ink-2 hover:text-ink"
            >
              {link.icon} {link.label} <ExternalLink size={10} />
            </a>
          ))}
          {data.canEdit ? (
            <button type="button" onClick={startEdit} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-ink-2 hover:bg-sunken hover:text-ink">
              <Pencil size={12} /> Edit languages & accounts
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

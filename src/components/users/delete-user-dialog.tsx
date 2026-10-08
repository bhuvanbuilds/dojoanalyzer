"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";

export type DeletableUser = {
  email: string;
  full_name: string | null;
  role: "super_admin" | "campus_manager" | "mentor" | "student";
  status: "active" | "pending";
  student_name: string | null;
};

const CONFIRM_WORD = "DELETE";

/**
 * Second step of deleting a user, opened after the hold button completes:
 * spells out what will be removed and requires typing DELETE.
 */
export function DeleteUserDialog({
  user,
  onClose,
  onDeleted,
}: {
  user: DeletableUser | null;
  onClose: () => void;
  onDeleted: (user: DeletableUser) => void;
}) {
  // Keep showing the last user while the dialog animates out.
  const [shown, setShown] = useState(user);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (user && user !== shown) {
    setShown(user);
    setTyped("");
    setError("");
  }

  const isStudent = shown?.role === "student";
  const confirmed = typed.trim() === CONFIRM_WORD;

  async function remove() {
    if (!shown || !confirmed) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/super-admin/users", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: shown.email, confirm: CONFIRM_WORD }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? "Unable to delete user.");
      onDeleted(shown);
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Unable to delete user.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={Boolean(user)}
      onClose={onClose}
      locked={pending}
      eyebrow="Delete user"
      title={shown?.full_name ?? shown?.email ?? "Delete user"}
      description={shown?.email}
      icon={<Trash2 size={18} />}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl border border-line-strong px-4 py-2 text-[13px] font-semibold text-ink-2 transition hover:text-ink disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={!confirmed || pending}
            className="inline-flex items-center gap-2 rounded-xl bg-action px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Trash2 size={14} />
            )}
            Delete permanently
          </button>
        </div>
      }
    >
      <div className="space-y-4 px-6 pb-2 pt-1">
        <div className="flex gap-3 rounded-xl border border-brand-line bg-brand-soft px-4 py-3 text-[13px] text-ink">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-brand-text" />
          <div>
            <p className="font-semibold">This can’t be undone.</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-ink-2">
              <li>
                {shown?.status === "pending"
                  ? "Their pending invitation is cancelled."
                  : "Their sign-in account and app access are removed."}
              </li>
              {isStudent ? (
                <li>
                  The student record
                  {shown?.student_name ? ` for ${shown.student_name}` : ""},
                  their squad membership and every weekly belt record are
                  deleted. They disappear from leaderboards and dashboards.
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <label className="block">
          <span className="text-[12.5px] font-semibold text-ink-2">
            Type <span className="font-mono text-brand-text">{CONFIRM_WORD}</span>{" "}
            to confirm
          </span>
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void remove();
            }}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder={CONFIRM_WORD}
            aria-invalid={typed.length > 0 && !confirmed}
            className={`mt-1.5 w-full rounded-xl border bg-surface px-3.5 py-2.5 font-mono text-[14px] tracking-[0.08em] outline-none transition placeholder:text-faint focus:ring-2 ${
              confirmed
                ? "border-action focus:ring-action/20"
                : "border-line-strong focus:ring-ink/10"
            }`}
          />
        </label>

        {error ? (
          <p role="alert" className="text-[12.5px] font-medium text-brand-text">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

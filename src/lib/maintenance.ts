import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * App-wide maintenance switch, stored in app_settings under "maintenance".
 * While it is on, only developers can use the app; everyone
 * else sees /maintenance. `until` (ISO time) ends it automatically; null
 * means "back soon" with no countdown.
 */
export type Maintenance = {
  enabled: boolean;
  until: string | null;
  message: string | null;
  startedAt: string | null;
};

const OFF: Maintenance = { enabled: false, until: null, message: null, startedAt: null };
const CACHE_MS = 10_000;
let cached: { at: number; value: Maintenance } | null = null;

function normalise(raw: unknown): Maintenance {
  if (!raw || typeof raw !== "object") return OFF;
  const value = raw as Partial<Maintenance>;
  const until = typeof value.until === "string" ? value.until : null;
  // A window that has run out turns itself off.
  if (!value.enabled || (until && Date.parse(until) <= Date.now())) return OFF;
  return {
    enabled: true,
    until,
    message: typeof value.message === "string" && value.message.trim() ? value.message : null,
    startedAt: typeof value.startedAt === "string" ? value.startedAt : null,
  };
}

export async function getMaintenance({ fresh = false } = {}): Promise<Maintenance> {
  if (!fresh && cached && Date.now() - cached.at < CACHE_MS) return normalise(cached.value);
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "maintenance")
    .maybeSingle();
  // Never lock people out because the setting can't be read (e.g. the
  // table hasn't been created yet): treat that as "off".
  if (error) {
    // Remember the miss briefly too, so a missing table isn't queried (and
    // logged) on every single request.
    if (!cached || Date.now() - cached.at >= CACHE_MS)
      console.error("Maintenance setting read failed:", error.message);
    cached = { at: Date.now(), value: OFF };
    return OFF;
  }
  const value = normalise(data?.value);
  cached = { at: Date.now(), value };
  return value;
}

export async function setMaintenance(next: Maintenance, userId: string) {
  const { error } = await supabaseAdmin.from("app_settings").upsert(
    { key: "maintenance", value: next, updated_by: userId, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  if (error) throw error;
  cached = { at: Date.now(), value: next };
}

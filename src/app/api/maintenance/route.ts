import { NextResponse } from "next/server";
import { requireDeveloper, writeAuditLog } from "@/lib/auth/authorization";
import { getMaintenance, setMaintenance } from "@/lib/maintenance";

const MAX_HOURS = 72;

/** GET: current maintenance state. Public, so the maintenance page can read it. */
export async function GET() {
  const maintenance = await getMaintenance({ fresh: true });
  return NextResponse.json(
    { maintenance },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * PUT { enabled, hours?, message? }: switch maintenance on or off.
 * Developers only. hours = null means "back soon" with no
 * end time; otherwise it ends by itself after that many hours.
 */
export async function PUT(request: Request) {
  const authorization = await requireDeveloper();
  if (authorization.response) return authorization.response;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      enabled?: unknown;
      hours?: unknown;
      message?: unknown;
    };
    if (typeof body.enabled !== "boolean")
      return NextResponse.json({ error: "Say whether maintenance is on or off" }, { status: 400 });

    const message =
      typeof body.message === "string" ? body.message.trim().slice(0, 280) || null : null;
    let until: string | null = null;
    if (body.enabled && body.hours !== null && body.hours !== undefined) {
      const hours = Number(body.hours);
      if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_HOURS)
        return NextResponse.json(
          { error: `Pick between a few minutes and ${MAX_HOURS} hours` },
          { status: 400 },
        );
      until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    }

    const next = body.enabled
      ? { enabled: true, until, message, startedAt: new Date().toISOString() }
      : { enabled: false, until: null, message: null, startedAt: null };
    await setMaintenance(next, authorization.user.id);
    await writeAuditLog(
      authorization.user.id,
      body.enabled ? "maintenance_on" : "maintenance_off",
      "app_settings",
      "maintenance",
      { until, message },
    );
    return NextResponse.json({ maintenance: next });
  } catch (error) {
    console.error("Maintenance PUT error:", error);
    return NextResponse.json(
      { error: "Couldn't change maintenance mode. Has the settings table been created?" },
      { status: 500 },
    );
  }
}

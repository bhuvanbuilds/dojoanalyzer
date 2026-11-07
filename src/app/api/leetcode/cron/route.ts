import { NextResponse } from "next/server";
import { syncStale } from "@/lib/leetcode-server";

/**
 * GET with "Authorization: Bearer <CRON_SECRET>": refreshes LeetCode accounts
 * not synced in the last 50 minutes. Point an hourly cron (Vercel Cron or any
 * scheduler) here so cards stay current even when nobody opens the page.
 * Without CRON_SECRET set, the endpoint stays off.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  try {
    const synced = await syncStale(null, 50, 250);
    return NextResponse.json({ synced });
  } catch (error) {
    console.error("LeetCode cron error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

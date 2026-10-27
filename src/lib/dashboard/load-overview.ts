"use client";

import type { DashboardData } from "@/lib/dashboard/metrics";

/**
 * Shared loader for /api/dashboard/overview. The response is large and slow
 * to build, so it is kept for a couple of minutes: moving between the
 * dashboard and pages drilled down from it reuses the same data.
 */
const TTL_MS = 2 * 60 * 1000;
const cache = new Map<string, { at: number; promise: Promise<DashboardData> }>();

export function overviewQuery(academicYear: string, universityId: string) {
  const params = new URLSearchParams();
  if (academicYear) params.set("academic_year", academicYear);
  if (universityId) params.set("university_id", universityId);
  return params.toString();
}

export function loadOverview(query: string, { fresh = false } = {}) {
  const hit = cache.get(query);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = fetch(`/api/dashboard/overview?${query}`).then(async (response) => {
    const body = (await response.json()) as DashboardData & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "Unable to load the dashboard.");
    return body;
  });
  // Failed loads are not kept, so "Try again" really retries.
  promise.catch(() => {
    if (cache.get(query)?.promise === promise) cache.delete(query);
  });
  cache.set(query, { at: Date.now(), promise });
  return promise;
}

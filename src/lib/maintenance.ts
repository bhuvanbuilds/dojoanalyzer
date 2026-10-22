/**
 * When the app reopens to people without an account yet. Anyone who signs in
 * without a profile lands on /maintenance and sees a countdown to this time.
 * Override with NEXT_PUBLIC_MAINTENANCE_UNTIL (any ISO time with an offset).
 */
export const MAINTENANCE_UNTIL =
  process.env.NEXT_PUBLIC_MAINTENANCE_UNTIL ?? "2026-10-22T17:00:00+05:30";

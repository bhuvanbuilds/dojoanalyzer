"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Filters that live in the URL, so every filter combination is its own
 * address: shareable, bookmarkable, and Back/Forward step through them.
 * Values equal to their default are left out of the URL.
 */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const values = Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [
      key,
      searchParams.get(key) ?? fallback,
    ]),
  ) as T;

  /**
   * Update some filters. Each change is its own history entry; pass
   * `{ replace: true }` for rapid changes such as typing in a search box.
   */
  function setFilters(patch: Partial<T>, { replace = false } = {}) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      if (value === "" || value === defaults[key]) params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }

  return [values, setFilters] as const;
}

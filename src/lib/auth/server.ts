import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createRequestSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components (e.g. /maintenance) can't write cookies. The
            // proxy refreshes the session on every request, so skipping is safe.
          }
        },
      },
    },
  );
}

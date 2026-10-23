import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { VIEW_AS_COOKIE } from "@/lib/view-as";

export async function createRequestSupabaseClient() {
  const cookieStore = await cookies();

  const client = createServerClient(
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
            // Server Components can't write cookies. The
            // proxy refreshes the session on every request, so skipping is safe.
          }
        },
      },
    },
  );
  // Carried along so the profile loader can apply a developer's "View as".
  return Object.assign(client, {
    viewAsCookie: cookieStore.get(VIEW_AS_COOKIE)?.value ?? null,
  });
}

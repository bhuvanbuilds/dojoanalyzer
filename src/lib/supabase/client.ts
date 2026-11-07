import { createBrowserClient } from "@supabase/ssr";
import { DB_OPTIONS } from "./schema";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  DB_OPTIONS,
);

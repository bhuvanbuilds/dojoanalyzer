import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";

export type StudentLinks = { github: string | null; linkedin: string | null; codechef: string | null };

/** GitHub, LinkedIn and CodeChef profile links for these students, by student id. */
export async function loadLinks(ids: string[]): Promise<Map<string, StudentLinks>> {
  const links = new Map<string, StudentLinks>();
  if (!ids.length) return links;
  const { data, error } = await supabaseAdmin
    .from("student_links")
    .select("student_id, github_url, linkedin_url, codechef_url")
    .in("student_id", ids);
  if (error) throw error;
  for (const row of data ?? [])
    links.set(row.student_id as string, {
      github: (row.github_url as string | null) ?? null,
      linkedin: (row.linkedin_url as string | null) ?? null,
      codechef: (row.codechef_url as string | null) ?? null,
    });
  return links;
}

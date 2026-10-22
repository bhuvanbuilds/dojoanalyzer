import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Everything behind sign-in is private student data; only the sign-in page is public.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/login", disallow: ["/", "/api/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

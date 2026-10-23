import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    // Changelog screenshots live in the public "changelog" storage bucket.
    // (next.config is read before .env files, so the host can't come from env.)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cwrcqdyyltoygreuhfgl.supabase.co",
        pathname: "/storage/v1/object/public/changelog/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;

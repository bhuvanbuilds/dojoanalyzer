import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dojo Belt Analyzer",
    short_name: "Dojo Belts",
    description: "Track Kalvium Dojo belt progress across squads and language tracks.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f3f1",
    theme_color: "#f4f3f1",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}

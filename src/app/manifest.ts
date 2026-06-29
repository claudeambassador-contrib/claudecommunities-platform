import type { MetadataRoute } from "next";
import { getRegionConfig } from "@/lib/region";

// Region-aware PWA manifest (served at /manifest.webmanifest). Name/description/
// lang follow the deploy's region via NEXT_PUBLIC_REGION.
export default function manifest(): MetadataRoute.Manifest {
  const { communityName, countryName, lang } = getRegionConfig();
  return {
    name: communityName,
    short_name: "Claude Community",
    description: `Connect with Claude Code enthusiasts across ${countryName}`,
    start_url: "/",
    display: "standalone",
    background_color: "#1C1917",
    theme_color: "#D4836A",
    orientation: "portrait-primary",
    scope: "/",
    icons: [
      { src: "/icons/favicon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/images/claude-code-logo.webp",
        sizes: "500x500",
        type: "image/webp",
        purpose: "any",
      },
    ],
    categories: ["social", "developer tools", "education"],
    lang,
  };
}

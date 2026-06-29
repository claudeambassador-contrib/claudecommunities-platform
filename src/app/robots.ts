import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/region";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/community/messages", "/community/settings"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

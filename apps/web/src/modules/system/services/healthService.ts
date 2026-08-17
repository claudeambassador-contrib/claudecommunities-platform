import { getRegionConfig } from "@/shared/region";

export async function healthService() {
  const region = getRegionConfig();
  return {
    ok: true,
    service: "@claudecommunities/web",
    region: region.region,
    siteName: region.siteName,
    ts: new Date().toISOString(),
  };
}

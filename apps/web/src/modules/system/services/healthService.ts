import { getRegionConfig } from "@/shared/region";

export function healthService() {
  const region = getRegionConfig();
  return {
    ok: true,
    region: region.region,
    service: "@claudecommunities/web",
    siteName: region.siteName,
    ts: new Date().toISOString(),
  };
}

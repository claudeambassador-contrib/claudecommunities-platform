import { getRegionConfig, siteUrl } from "@/lib/region";

// Region-aware /.well-known/security.txt (replaces the old static public file
// that hardcoded the AU security contact + canonical URL).
export const dynamic = "force-static";

export function GET() {
  const { senderDomain } = getRegionConfig();
  const body = `${[
    `Contact: mailto:security@${senderDomain}`,
    "Expires: 2027-04-25T00:00:00.000Z",
    "Preferred-Languages: en",
    `Canonical: ${siteUrl()}/.well-known/security.txt`,
  ].join("\n")}\n`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

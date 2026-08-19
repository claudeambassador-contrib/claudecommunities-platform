export interface BuiltInIndustry {
  detail: string;
  slug: string;
  title: string;
}

export const BUILT_IN_INDUSTRIES: BuiltInIndustry[] = [
  {
    detail: "Shopify, checkout flows, and storefronts.",
    slug: "ecommerce",
    title: "E-commerce",
  },
  {
    detail: "Landing pages, campaigns, and analytics.",
    slug: "marketing",
    title: "Marketing",
  },
  {
    detail: "MVPs, auth, billing, and admin tools.",
    slug: "saas",
    title: "SaaS",
  },
  {
    detail: "Listings, search, and agent portals.",
    slug: "real-estate",
    title: "Real estate",
  },
];

const FOR_PREFIX_RE = /^for\//;
const NON_SLUG_RE = /[^a-z0-9]+/g;
const EDGE_DASH_RE = /^-+|-+$/g;

export function industrySlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(FOR_PREFIX_RE, "")
    .replace(NON_SLUG_RE, "-")
    .replace(EDGE_DASH_RE, "")
    .slice(0, 48);
}

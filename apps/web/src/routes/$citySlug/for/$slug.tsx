import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getPublishedPage } from "@/modules/pages/services/pagesService";
import type { PublishedPage } from "@/modules/pages/types";
import { loadCityPage } from "@/shared/http/cityPage";
import { getRegionConfig } from "@/shared/region";
import { EmptyCard, PageHeader } from "@/shared/ui/page";

const INDUSTRY_COPY: Record<string, { blurb: string; name: string }> = {
  ecommerce: {
    blurb:
      "Shopify themes, checkout, and product pages — ship storefronts faster with Claude Code.",
    name: "E-commerce",
  },
  marketing: {
    blurb: "Landing pages, email templates, and analytics dashboards for campaign teams.",
    name: "Marketing",
  },
  saas: {
    blurb: "MVPs, auth, APIs, and billing — product teams using Claude Code to ship SaaS faster.",
    name: "SaaS",
  },
  "real-estate": {
    blurb: "Listings, search, and agent tools for PropTech builders.",
    name: "Real estate",
  },
};

function cmsCopy(page: PublishedPage): { body: string; title: string } {
  const parts: string[] = [];
  for (const block of page.blocks) {
    if (!block.enabled) {
      continue;
    }
    if (block.type === "hero" || block.type === "richText") {
      if (block.heading) {
        parts.push(block.heading);
      }
      if (block.body) {
        parts.push(block.body);
      }
    }
  }
  return { body: parts.join("\n\n"), title: page.title };
}

function fallbackIndustry(slug: string): { blurb: string; name: string } {
  const known = INDUSTRY_COPY[slug];
  if (known) {
    return known;
  }
  const name = slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return {
    blurb: `How ${name || "this industry"} teams use Claude Code to ship faster.`,
    name: name || "Industry",
  };
}

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string; slug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return { cms: null as { body: string; title: string } | null };
    }
    const direct = await getPublishedPage(page.store, data.slug);
    const prefixed =
      direct.ok && direct.page ? direct : await getPublishedPage(page.store, `for/${data.slug}`);
    const published = prefixed.ok ? prefixed.page : null;
    return { cms: published ? cmsCopy(published) : null };
  });

export const Route = createFileRoute("/$citySlug/for/$slug")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug, slug: params.slug } }),
  component: Page,
});

function Page() {
  const { tenant } = Route.useRouteContext();
  const { slug } = Route.useParams();
  const { cms } = Route.useLoaderData();
  const { siteName } = getRegionConfig();
  const fallback = fallbackIndustry(slug);
  const city = { citySlug: tenant.slug };

  return (
    <section className="stack">
      <PageHeader
        actions={
          <div className="row">
            <a className="btn" href={`/${tenant.slug}/for`}>
              All industries
            </a>
            <Link className="btn btn-primary" params={city} to="/$citySlug/events">
              Events
            </Link>
          </div>
        }
        subtitle={siteName}
        title={cms?.title ?? `Claude Code for ${fallback.name}`}
      />
      {cms?.body ? (
        <div className="card">
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{cms.body}</p>
        </div>
      ) : (
        <div className="card">
          <p style={{ margin: 0 }}>{fallback.blurb}</p>
        </div>
      )}
      {cms ? null : (
        <EmptyCard>
          No published CMS page for this industry yet. Join an event or the community to meet
          builders in {fallback.name}.
        </EmptyCard>
      )}
    </section>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";

import { listPublicTenants } from "@/modules/tenants/services/publicListService";
import { loadRegistryPage } from "@/shared/http/registryPage";
import { getRegionConfig } from "@/shared/region";

const load = createServerFn({ method: "GET" }).handler(async () => {
  const { registry } = await loadRegistryPage();
  const listed = await listPublicTenants(registry.db);
  return { cities: listed.ok ? listed.tenants : [] };
});

export const Route = createFileRoute("/pricing")({
  loader: () => load(),
  staleTime: 60_000,
  component: PricingPage,
  head: () => {
    const { siteName } = getRegionConfig();
    return {
      meta: [
        { title: "Membership & Pricing" },
        {
          content: `${siteName} membership tiers. Join for events, workshops, and meetups.`,
          name: "description",
        },
      ],
    };
  },
});

function PricingPage(): ReactElement {
  const { cities } = Route.useLoaderData();
  const { majorCitiesPhrase, siteName } = getRegionConfig();

  return (
    <main className="shell stack">
      <h1 className="m-0">Membership & pricing</h1>
      <p className="muted">
        {siteName} — events and workshops across {majorCitiesPhrase}. Each city publishes its own
        catalog.
      </p>
      {cities.length === 0 ? (
        <div className="card muted">No cities provisioned yet.</div>
      ) : (
        cities.map((city) => (
          <Link
            className="card block"
            key={city.slug}
            params={{ citySlug: city.slug }}
            to="/$citySlug/membership"
          >
            <strong>{city.name}</strong>
            <div className="muted">View membership tiers</div>
          </Link>
        ))
      )}
      <div className="row">
        <Link className="btn btn-primary" to="/signup">
          Sign up
        </Link>
        <Link className="btn" to="/">
          City directory
        </Link>
      </div>
    </main>
  );
}

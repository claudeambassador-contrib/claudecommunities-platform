import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listPublicTenants } from "@/modules/tenants/services/publicListService";
import { getRegionConfig } from "@/shared/region";

const load = createServerFn({ method: "GET" }).handler(async () => {
  const listed = await listPublicTenants();
  return { cities: listed.ok ? listed.tenants : [] };
});

export const Route = createFileRoute("/pricing")({
  loader: () => load(),
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

function PricingPage() {
  const { cities } = Route.useLoaderData();
  const { majorCitiesPhrase, siteName } = getRegionConfig();

  return (
    <main className="shell stack">
      <h1 style={{ margin: 0 }}>Membership & pricing</h1>
      <p className="muted">
        {siteName} — events and workshops across {majorCitiesPhrase}. Each city publishes its own
        catalog.
      </p>
      {cities.length === 0 ? (
        <div className="card muted">No cities provisioned yet.</div>
      ) : (
        cities.map((city) => (
          <Link
            className="card"
            key={city.slug}
            params={{ citySlug: city.slug }}
            style={{ display: "block" }}
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

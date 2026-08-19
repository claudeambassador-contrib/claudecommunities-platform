import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import { createTier, listTiers } from "@/modules/tiers/services/tiersService";
import type { TierSummary } from "@/modules/tiers/types";
import { ensurePermission } from "@/shared/auth/actor";
import { loadCityPage } from "@/shared/http/cityPage";
import { Can } from "@/shared/ui/can";
import { DeniedCard, EmptyCard, PageHeader } from "@/shared/ui/page";

const loadTiers = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated", tiers: [] as TierSummary[] };
    }
    const perm = ensurePermission(page.actor, "tiers.view");
    if (!perm.ok) {
      return { allowed: false as const, reason: perm.error.code, tiers: [] as TierSummary[] };
    }
    const listed = await listTiers(page.store, page.actor);
    if (!listed.ok) {
      return { allowed: false as const, reason: listed.error.code, tiers: [] as TierSummary[] };
    }
    return { allowed: true as const, tiers: listed.tiers };
  });

const submitTier = createServerFn({ method: "POST" })
  .validator(
    (d: {
      citySlug: string;
      description: string;
      name: string;
      price: number;
      yearlyPrice: number | null;
    }) => d,
  )
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { error: "unauthenticated", ok: false as const };
    }
    const result = await createTier(page.store, page.actor, {
      description: data.description,
      name: data.name,
      price: data.price,
      yearlyPrice: data.yearlyPrice,
    });
    if (!result.ok) {
      return { error: result.error.message ?? result.error.code, ok: false as const };
    }
    return { ok: true as const };
  });

export const Route = createFileRoute("/$citySlug/admin/tiers")({
  loader: ({ params }) => loadTiers({ data: { citySlug: params.citySlug } }),
  component: AdminTiersPage,
});

function formatPrice(tier: TierSummary): string {
  const monthly = `$${tier.price}/month`;
  if (tier.yearlyPrice === null) {
    return monthly;
  }
  return `${monthly} · $${tier.yearlyPrice}/year`;
}

function AdminTiersPage() {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Tiers" />;
  }

  return (
    <section className="stack">
      <PageHeader subtitle="Catalog only — payments are not wired." title="Tiers" />
      <Can permission="tiers.edit">
        <TierForm citySlug={citySlug} />
      </Can>
      {data.tiers.length === 0 ? (
        <EmptyCard>No membership tiers yet.</EmptyCard>
      ) : (
        <div className="stack">
          {data.tiers.map((tier) => (
            <article className="card" key={tier.id}>
              <strong>{tier.name}</strong>
              <div className="muted">
                {formatPrice(tier)}
                {tier.isActive ? "" : " · Inactive"}
              </div>
              {tier.description ? (
                <p style={{ margin: "0.25rem 0 0" }}>{tier.description}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function TierForm({ citySlug }: { citySlug: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const fd = new FormData(form);
      const yearlyRaw = String(fd.get("yearlyPrice") ?? "").trim();
      const result = await submitTier({
        data: {
          citySlug,
          description: String(fd.get("description") ?? ""),
          name: String(fd.get("name") ?? ""),
          price: Number(fd.get("price") || 0),
          yearlyPrice: yearlyRaw === "" ? null : Number(yearlyRaw),
        },
      });
      if (result.ok) {
        form.reset();
        setStatus("Tier created.");
        await router.invalidate();
        return;
      }
      setStatus(result.error);
    },
    [citySlug, router],
  );

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <input className="field" name="name" placeholder="Name" required />
      <input className="field" name="description" placeholder="Description" />
      <input
        className="field"
        min="0"
        name="price"
        placeholder="Monthly price"
        step="0.01"
        type="number"
      />
      <input
        className="field"
        min="0"
        name="yearlyPrice"
        placeholder="Yearly price (optional)"
        step="0.01"
        type="number"
      />
      {status ? <p className="muted">{status}</p> : null}
      <button className="btn btn-primary" type="submit">
        Create tier
      </button>
    </form>
  );
}

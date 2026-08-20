import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { tierWriteInput } from "@/modules/tiers/schemas";
import { createTier, listTiers } from "@/modules/tiers/services/tiersService";
import type { TierSummary } from "@/modules/tiers/types";
import { cityHandler, cityInput, cityMutationHandler } from "@/shared/http/cityFn";
import { Can } from "@/shared/ui/can";
import { DeniedCard, EmptyCard, PageHeader } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const loadTiersInput = cityInput();

const loadTiers = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadTiersInput.parse(input))
  .handler(cityHandler((page) => listTiers(page.store, page.actor)));

// price/yearlyPrice/description stay explicit here rather than reused from
// tierWriteInput: the module schema's `.coerce`/`.default()` on price and
// yearlyPrice and `.optional()` on description would loosen this route's
// wire contract (all four fields are always sent, required, by the form).
// `name` is safe to reuse — its shape only tightens (trim + min length)
// without changing required-ness.
const submitTierInput = cityInput({
  ...tierWriteInput.pick({ name: true }).shape,
  description: z.string(),
  price: z.number(),
  yearlyPrice: z.number().nullable(),
});

const submitTier = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitTierInput.parse(input))
  .handler(
    cityMutationHandler((page, data) =>
      createTier(page.store, page.actor, {
        description: data.description,
        name: data.name,
        price: data.price,
        yearlyPrice: data.yearlyPrice,
      }),
    ),
  );

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

function AdminTiersPage(): ReactElement {
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
              {tier.description ? <p className="mt-1">{tier.description}</p> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function TierForm({ citySlug }: { citySlug: string }): ReactElement {
  const { error, handleSubmit, pending, success } = useFormSubmit({
    resetOnSuccess: true,
    submit: (fd) => {
      const yearlyRaw = formString(fd, "yearlyPrice").trim();
      return submitTier({
        data: {
          citySlug,
          description: formString(fd, "description"),
          name: formString(fd, "name"),
          price: Number(fd.get("price") || 0),
          yearlyPrice: yearlyRaw === "" ? null : Number(yearlyRaw),
        },
      });
    },
    successMessage: "Tier created.",
  });

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <label className="field-label">
        Name
        <input className="field" name="name" required />
      </label>
      <label className="field-label">
        Description
        <input className="field" name="description" />
      </label>
      <label className="field-label">
        Monthly price
        <input className="field" min="0" name="price" step="0.01" type="number" />
      </label>
      <label className="field-label">
        Yearly price (optional)
        <input className="field" min="0" name="yearlyPrice" step="0.01" type="number" />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Saving…" : "Create tier"}
      </button>
    </form>
  );
}

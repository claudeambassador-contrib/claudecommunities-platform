import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import { importMembers, parseMemberCsv } from "@/modules/identity/services/usersService";
import type { ImportMemberResult } from "@/modules/identity/types";
import { ensurePermission } from "@/shared/auth/actor";
import { loadCityPage } from "@/shared/http/cityPage";
import { DeniedCard, PageHeader } from "@/shared/ui/page";

const loadImport = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    const perm = ensurePermission(page.actor, "users.import");
    if (!perm.ok) {
      return { allowed: false as const, reason: perm.error.code };
    }
    return { allowed: true as const };
  });

const submitImport = createServerFn({ method: "POST" })
  .validator((d: { citySlug: string; csv: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { error: "unauthenticated", ok: false as const };
    }
    const rows = parseMemberCsv(data.csv);
    const result = await importMembers(page.registry, page.actor, page.tenant.orgId, rows);
    if (!result.ok) {
      return { error: result.error.message ?? result.error.code, ok: false as const };
    }
    return { ok: true as const, result };
  });

export const Route = createFileRoute("/$citySlug/admin/import")({
  loader: ({ params }) => loadImport({ data: { citySlug: params.citySlug } }),
  component: ImportPage,
});

function ImportPage() {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Import" />;
  }

  return (
    <section className="stack">
      <PageHeader
        subtitle="CSV: email,name per line. Existing emails get a city membership."
        title="Import"
      />
      <ImportForm citySlug={citySlug} />
    </section>
  );
}

function ImportForm({ citySlug }: { citySlug: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<ImportMemberResult | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const response = await submitImport({
        data: { citySlug, csv: String(fd.get("csv") ?? "") },
      });
      if (response.ok) {
        setStatus(null);
        setResult(response.result);
        return;
      }
      setResult(null);
      setStatus(response.error);
    },
    [citySlug],
  );

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <textarea
        className="field"
        name="csv"
        placeholder={"email,name\nada@example.com,Ada Lovelace"}
        required
        rows={10}
        style={{ width: "100%" }}
      />
      {status ? <p className="muted">{status}</p> : null}
      {result ? (
        <p className="muted">
          Created {result.created}, updated {result.updated}, skipped {result.skipped}
          {result.errors.length > 0 ? `, ${result.errors.length} errors` : ""}.
        </p>
      ) : null}
      <button className="btn btn-primary" type="submit">
        Import
      </button>
    </form>
  );
}

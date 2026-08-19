import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { importMembers, parseMemberCsv } from "@/modules/identity/services/usersService";
import type { ImportMemberResult } from "@/modules/identity/types";
import { ok } from "@/shared/http/errors";
import { guarded, guardedMutation, type Mutated } from "@/shared/http/guarded";
import { DeniedCard, PageHeader } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const loadImportInput = z.object({ citySlug: z.string().min(1) });

const loadImport = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadImportInput.parse(input))
  .handler(({ data }) => guarded(data.citySlug, "users.import", () => Promise.resolve(ok({}))));

const submitImportInput = z.object({ citySlug: z.string().min(1), csv: z.string() });

const submitImport = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitImportInput.parse(input))
  .handler(({ data }) =>
    guardedMutation(data.citySlug, "users.import", async (page) => {
      const rows = parseMemberCsv(data.csv);
      const result = await importMembers(page.registry, page.actor, page.tenant.orgId, rows);
      if (!result.ok) {
        return result;
      }
      return ok({ result });
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/import")({
  loader: ({ params }) => loadImport({ data: { citySlug: params.citySlug } }),
  component: ImportPage,
});

function ImportPage(): ReactElement {
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

function importSummary(result: ImportMemberResult): string {
  const errors = result.errors.length > 0 ? `, ${result.errors.length} errors` : "";
  return `Created ${result.created}, updated ${result.updated}, skipped ${result.skipped}${errors}.`;
}

function ImportForm({ citySlug }: { citySlug: string }): ReactElement {
  const { error, handleSubmit, pending, success } = useFormSubmit<
    Mutated<{ result: ImportMemberResult }>
  >({
    submit: (fd) => submitImport({ data: { citySlug, csv: formString(fd, "csv") } }),
    successMessage: (okResult) => importSummary(okResult.result),
  });

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <label className="field-label">
        Members CSV
        <textarea
          className="field w-full"
          name="csv"
          placeholder={"email,name\nada@example.com,Ada Lovelace"}
          required
          rows={10}
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Importing…" : "Import"}
      </button>
    </form>
  );
}

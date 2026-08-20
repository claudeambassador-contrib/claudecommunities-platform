import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { listPublicTenants, provisionCity } from "@/modules/tenants/services/publicListService";
import { loadRegistryPage } from "@/shared/http/registryPage";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const loadPlatform = createServerFn({ method: "GET" }).handler(async () => {
  const { auth, registry } = await loadRegistryPage();
  if (!auth?.isSuperAdmin) {
    return { allowed: false as const, tenants: [] as { slug: string; name: string }[] };
  }
  const list = await listPublicTenants(registry.db);
  return {
    allowed: true as const,
    tenants: list.ok ? list.tenants : [],
  };
});

const provisionInput = z.object({
  name: z.string(),
  region: z.enum(["au", "nz"]).optional(),
  slug: z.string(),
});

const provision = createServerFn({ method: "POST" })
  .validator((input: unknown) => provisionInput.parse(input))
  .handler(async ({ data }) => {
    const { auth, registry } = await loadRegistryPage();
    if (!auth?.isSuperAdmin) {
      return { ok: false as const, error: "forbidden" };
    }
    const result = await provisionCity(registry.db, data);
    if (!result.ok) {
      return { ok: false as const, error: result.error.code };
    }
    return { ok: true as const, tenant: result.tenant };
  });

export const Route = createFileRoute("/admin/")({
  loader: () => loadPlatform(),
  component: PlatformAdmin,
});

function PlatformAdmin(): ReactElement {
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return (
      <main className="shell">
        <div className="card">
          <h1>Platform admin</h1>
          <p className="muted">Super-admin access required.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="shell stack">
      <h1 className="m-0">Platform admin</h1>
      <p className="muted">
        Provision city instances (registry row). Create D1 + migrate separately.
      </p>
      <div className="card stack">
        <strong>Cities</strong>
        {data.tenants.map((t) => (
          <div key={t.slug}>
            {t.name} <span className="muted">/{t.slug}</span>
          </div>
        ))}
      </div>
      <ProvisionForm />
    </main>
  );
}

function ProvisionForm(): ReactElement {
  const { error, handleSubmit, pending, success } = useFormSubmit({
    resetOnSuccess: true,
    submit: (fd) =>
      provision({
        data: { name: formString(fd, "name"), region: "au", slug: formString(fd, "slug") },
      }),
    successMessage: "City provisioned.",
  });

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <strong>Provision city</strong>
      <label className="field-label">
        Slug
        <input className="field" name="slug" placeholder="sydney" required />
      </label>
      <label className="field-label">
        Name
        <input className="field" name="name" placeholder="Sydney" required />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Creating…" : "Create registry row"}
      </button>
    </form>
  );
}

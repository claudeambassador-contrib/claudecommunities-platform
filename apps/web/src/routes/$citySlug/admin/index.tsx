import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { buildCityRouteContext } from "@/modules/identity/services/sessionService";
import { Can } from "@/shared/ui/can";
import { DeniedCard } from "@/shared/ui/page";

const loadAdminInput = z.object({ citySlug: z.string().min(1) });

const loadAdmin = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadAdminInput.parse(input))
  .handler(async ({ data }) => {
    const built = await buildCityRouteContext(data.citySlug);
    if (!built.ok) {
      return { allowed: false as const, reason: built.error.code };
    }
    const { auth, tenant } = built.ctx;
    const allowed = Boolean(
      auth && (auth.isSuperAdmin || auth.role === "owner" || auth.role === "admin"),
    );
    return {
      allowed,
      isSuperAdmin: Boolean(auth?.isSuperAdmin),
      permissions: auth ? [...auth.permissions] : [],
      reason: allowed ? null : "forbidden",
      role: auth?.role ?? null,
      tenantName: tenant.name,
    };
  });

export const Route = createFileRoute("/$citySlug/admin/")({
  loader: ({ params }) => loadAdmin({ data: { citySlug: params.citySlug } }),
  component: AdminHome,
});

function AdminHome(): ReactElement {
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Admin" />;
  }

  return (
    <section className="stack">
      <div className="card">
        <h2 className="mt-0">{data.tenantName} admin</h2>
        <p className="muted">Role: {data.role ?? "none"}</p>
        <p className="muted">{data.permissions.length} permissions granted</p>
        <Can fallback={<p className="muted">Read-only analytics.</p>} permission="analytics.view">
          <p className="muted">You can open analytics from the sidebar.</p>
        </Can>
      </div>
    </section>
  );
}

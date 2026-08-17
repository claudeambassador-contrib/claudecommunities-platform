import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { buildCityRouteContext } from "@/modules/identity/services/sessionService";

const loadAdmin = createServerFn({ method: "GET" })
  .inputValidator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const built = await buildCityRouteContext(data.citySlug);
    if (!built.ok) {
      return { allowed: false as const, reason: built.error.code };
    }
    const { auth, tenant } = built.ctx;
    const allowed =
      !!auth &&
      (auth.isSuperAdmin || auth.role === "owner" || auth.role === "admin");
    return {
      allowed,
      reason: allowed ? null : "forbidden",
      role: auth?.role ?? null,
      permissions: auth ? [...auth.permissions] : [],
      tenantName: tenant.name,
    };
  });

export const Route = createFileRoute("/$citySlug/admin/")({
  loader: ({ params }) => loadAdmin({ data: { citySlug: params.citySlug } }),
  component: AdminHome,
});

function AdminHome() {
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Admin</h2>
        <p className="muted">Access denied ({data.reason}).</p>
      </div>
    );
  }

  return (
    <section className="stack">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>{data.tenantName} admin</h2>
        <p className="muted">Role: {data.role ?? "none"}</p>
        <p className="muted">{data.permissions.length} permissions granted</p>
      </div>
      <div className="card stack">
        <strong>Modules</strong>
        <span className="muted">
          Events · Community · Courses · Talks · Email · Social · Slides · Pages
        </span>
      </div>
    </section>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { listPublicTenants, provisionCity } from "@/modules/tenants/services/publicListService";
import { syncSessionUser } from "@/modules/identity/services/sessionService";

const loadPlatform = createServerFn({ method: "GET" }).handler(async () => {
  const session = await auth();
  if (!session.isAuthenticated) {
    return { allowed: false as const, tenants: [] as { slug: string; name: string }[] };
  }
  const user = await syncSessionUser();
  if (!user.ok || !user.auth.isSuperAdmin) {
    return { allowed: false as const, tenants: [] as { slug: string; name: string }[] };
  }
  const list = await listPublicTenants();
  return {
    allowed: true as const,
    tenants: list.ok ? list.tenants : [],
  };
});

const provision = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; name: string; region?: "au" | "nz" }) => d)
  .handler(async ({ data }) => {
    const user = await syncSessionUser();
    if (!user.ok || !user.auth.isSuperAdmin) {
      return { ok: false as const, error: "forbidden" };
    }
    const result = await provisionCity(data);
    if (!result.ok) return { ok: false as const, error: result.error.code };
    return { ok: true as const, tenant: result.tenant };
  });

export const Route = createFileRoute("/admin/")({
  loader: () => loadPlatform(),
  component: PlatformAdmin,
});

function PlatformAdmin() {
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
      <h1 style={{ margin: 0 }}>Platform admin</h1>
      <p className="muted">Provision city instances (registry row). Create D1 + migrate separately.</p>
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

function ProvisionForm() {
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const slug = String(fd.get("slug") ?? "");
        const name = String(fd.get("name") ?? "");
        const result = await provision({ data: { slug, name, region: "au" } });
        if (result.ok) {
          window.location.reload();
        } else {
          alert(result.error);
        }
      }}
    >
      <strong>Provision city</strong>
      <input name="slug" placeholder="sydney" required className="btn" style={{ width: "100%" }} />
      <input name="name" placeholder="Sydney" required className="btn" style={{ width: "100%" }} />
      <button type="submit" className="btn btn-primary">
        Create registry row
      </button>
    </form>
  );
}

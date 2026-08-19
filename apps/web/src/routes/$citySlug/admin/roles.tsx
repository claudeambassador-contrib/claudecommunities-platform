import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getPermissionCatalog, listRoles } from "@/modules/roles/services/rolesService";
import { ok } from "@/shared/http/errors";
import { guarded } from "@/shared/http/guarded";
import { DeniedCard, EmptyCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadRoles = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(({ data }) =>
    guarded(data.citySlug, null, async (page) => {
      const result = await listRoles(page.store, page.actor);
      if (!result.ok) {
        return result;
      }
      const catalog = getPermissionCatalog(page.actor);
      if (!catalog.ok) {
        return catalog;
      }
      return ok({
        catalog: Object.entries(catalog.permissions).map(([key, label]) => ({ key, label })),
        roles: result.roles.map((role) => ({
          detail: `${role.permissions.length} permissions · ${role.userCount} users`,
          id: role.name,
          title: role.name,
        })),
      });
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/roles")({
  loader: ({ params }) => loadRoles({ data: { citySlug: params.citySlug } }),
  component: AdminRolesPage,
});

function AdminRolesPage() {
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Roles" />;
  }

  return (
    <section className="stack">
      <PageHeader title="Roles" />
      <ItemList empty="No roles yet." items={data.roles} />
      <div className="card stack">
        <strong>Permission catalog</strong>
        {data.catalog.length === 0 ? (
          <EmptyCard>No permissions in catalog.</EmptyCard>
        ) : (
          data.catalog.map((item) => (
            <div key={item.key}>
              <code>{item.key}</code>
              <div className="muted">{item.label}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

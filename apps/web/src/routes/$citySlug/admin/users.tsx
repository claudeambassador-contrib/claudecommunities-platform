import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listUsers } from "@/modules/identity/services/usersService";
import { loadCityPage } from "@/shared/http/cityPage";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadUsers = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    const result = await listUsers(page.registry, page.actor, page.tenant.orgId);
    if (!result.ok) {
      return { allowed: false as const, reason: result.error.code };
    }
    return {
      allowed: true as const,
      users: result.users.map((user) => ({
        detail: [user.email, user.role].filter(Boolean).join(" · "),
        id: user.id,
        title: user.displayName || user.email,
      })),
    };
  });

export const Route = createFileRoute("/$citySlug/admin/users")({
  loader: ({ params }) => loadUsers({ data: { citySlug: params.citySlug } }),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Users" />;
  }

  return (
    <section className="stack">
      <PageHeader title="Users" />
      <ItemList empty="No members yet." items={data.users} />
    </section>
  );
}

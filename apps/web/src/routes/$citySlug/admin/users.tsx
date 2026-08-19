import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { listUsers } from "@/modules/identity/services/usersService";
import { ok } from "@/shared/http/errors";
import { guarded } from "@/shared/http/guarded";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadUsersInput = z.object({ citySlug: z.string().min(1) });

const loadUsers = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadUsersInput.parse(input))
  .handler(({ data }) =>
    guarded(data.citySlug, "users.view", async (page) => {
      const result = await listUsers(page.registry, page.actor, page.tenant.orgId);
      if (!result.ok) {
        return result;
      }
      return ok({
        users: result.users.map((user) => ({
          detail: [user.email, user.role].filter(Boolean).join(" · "),
          id: user.id,
          title: user.displayName || user.email,
        })),
      });
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/users")({
  loader: ({ params }) => loadUsers({ data: { citySlug: params.citySlug } }),
  component: AdminUsersPage,
});

function AdminUsersPage(): ReactElement {
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

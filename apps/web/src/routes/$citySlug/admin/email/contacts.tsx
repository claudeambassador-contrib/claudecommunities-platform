import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { listEmailContacts } from "@/modules/identity/services/usersService";
import { ok } from "@/shared/http/errors";
import { guarded } from "@/shared/http/guarded";
import { DeniedCard, EmptyCard, PageHeader } from "@/shared/ui/page";

const loadContactsInput = z.object({ citySlug: z.string().min(1) });

const loadContacts = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadContactsInput.parse(input))
  .handler(({ data }) =>
    guarded(data.citySlug, "email.view", async (page) => {
      const listed = await listEmailContacts(page.registry, page.actor, page.tenant.orgId);
      if (!listed.ok) {
        return listed;
      }
      return ok({
        contacts: listed.users.map((user) => ({
          email: user.email,
          id: user.id,
          name: user.displayName ?? user.email,
          role: user.role,
        })),
      });
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/email/contacts")({
  loader: ({ params }) => loadContacts({ data: { citySlug: params.citySlug } }),
  component: EmailContactsPage,
});

function EmailContactsPage(): ReactElement {
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Contacts" />;
  }

  return (
    <section className="stack">
      <PageHeader subtitle="City members available as campaign recipients." title="Contacts" />
      {data.contacts.length === 0 ? (
        <EmptyCard>No members in this city yet.</EmptyCard>
      ) : (
        <div className="stack">
          {data.contacts.map((contact) => (
            <article className="card" key={contact.id}>
              <strong>{contact.name}</strong>
              <div className="muted">
                {contact.email}
                {contact.role ? ` · ${contact.role}` : ""}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

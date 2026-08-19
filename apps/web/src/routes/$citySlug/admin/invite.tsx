import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { inviteMember, listInvites } from "@/modules/identity/services/usersService";
import type { InviteRecord } from "@/modules/identity/types";
import { ok } from "@/shared/http/errors";
import { guarded, guardedMutation } from "@/shared/http/guarded";
import { DeniedCard, EmptyCard, PageHeader } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const loadInviteInput = z.object({ citySlug: z.string().min(1) });

const loadInvite = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInviteInput.parse(input))
  .handler(({ data }) =>
    guarded(data.citySlug, "users.invite", async (page) => {
      const listed = await listInvites(page.registry, page.actor, page.tenant.orgId);
      return ok({
        invites: listed.ok ? listed.invites : ([] as InviteRecord[]),
      });
    }),
  );

const submitInviteInput = z.object({
  citySlug: z.string().min(1),
  displayName: z.string(),
  email: z.string(),
});

const submitInvite = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitInviteInput.parse(input))
  .handler(({ data }) =>
    guardedMutation(data.citySlug, "users.invite", (page) =>
      inviteMember(page.registry, page.actor, page.tenant.orgId, {
        displayName: data.displayName,
        email: data.email,
      }),
    ),
  );

export const Route = createFileRoute("/$citySlug/admin/invite")({
  loader: ({ params }) => loadInvite({ data: { citySlug: params.citySlug } }),
  component: InvitePage,
});

function InvitePage(): ReactElement {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Invite" />;
  }

  return (
    <section className="stack">
      <PageHeader
        subtitle="Creates a city membership. They sign up with this email to claim it."
        title="Invite"
      />
      <InviteForm citySlug={citySlug} />
      {data.invites.length === 0 ? (
        <EmptyCard>No pending invites.</EmptyCard>
      ) : (
        <div className="stack">
          {data.invites.map((invite) => (
            <article className="card" key={invite.id}>
              <strong>{invite.displayName || invite.email}</strong>
              <div className="muted">
                {invite.email} · {invite.hasSignedUp ? "Signed up" : "Pending"} ·{" "}
                {new Date(invite.createdAt).toLocaleDateString()}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function InviteForm({ citySlug }: { citySlug: string }): ReactElement {
  const { error, handleSubmit, pending, success } = useFormSubmit({
    resetOnSuccess: true,
    submit: (fd) =>
      submitInvite({
        data: {
          citySlug,
          displayName: formString(fd, "displayName"),
          email: formString(fd, "email"),
        },
      }),
    successMessage: "Invite recorded.",
  });

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <label className="field-label">
        Email
        <input className="field" name="email" placeholder="Email" required type="email" />
      </label>
      <label className="field-label">
        Name (optional)
        <input className="field" name="displayName" placeholder="Name (optional)" />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Inviting…" : "Invite"}
      </button>
    </form>
  );
}

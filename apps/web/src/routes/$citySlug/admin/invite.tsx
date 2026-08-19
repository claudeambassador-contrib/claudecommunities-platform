import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import { inviteMember, listInvites } from "@/modules/identity/services/usersService";
import type { InviteRecord } from "@/modules/identity/types";
import { ensurePermission } from "@/shared/auth/actor";
import { loadCityPage } from "@/shared/http/cityPage";
import { DeniedCard, EmptyCard, PageHeader } from "@/shared/ui/page";

const loadInvite = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, invites: [] as InviteRecord[], reason: "unauthenticated" };
    }
    const perm = ensurePermission(page.actor, "users.invite");
    if (!perm.ok) {
      return { allowed: false as const, invites: [] as InviteRecord[], reason: perm.error.code };
    }
    const listed = await listInvites(page.registry, page.actor, page.tenant.orgId);
    return {
      allowed: true as const,
      invites: listed.ok ? listed.invites : [],
    };
  });

const submitInvite = createServerFn({ method: "POST" })
  .validator((d: { citySlug: string; displayName: string; email: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { error: "unauthenticated", ok: false as const };
    }
    const result = await inviteMember(page.registry, page.actor, page.tenant.orgId, {
      displayName: data.displayName,
      email: data.email,
    });
    if (!result.ok) {
      return { error: result.error.message ?? result.error.code, ok: false as const };
    }
    return { ok: true as const };
  });

export const Route = createFileRoute("/$citySlug/admin/invite")({
  loader: ({ params }) => loadInvite({ data: { citySlug: params.citySlug } }),
  component: InvitePage,
});

function InvitePage() {
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

function InviteForm({ citySlug }: { citySlug: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const fd = new FormData(form);
      const result = await submitInvite({
        data: {
          citySlug,
          displayName: String(fd.get("displayName") ?? ""),
          email: String(fd.get("email") ?? ""),
        },
      });
      if (result.ok) {
        form.reset();
        setStatus("Invite recorded.");
        await router.invalidate();
        return;
      }
      setStatus(result.error);
    },
    [citySlug, router],
  );

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <input className="field" name="email" placeholder="Email" required type="email" />
      <input className="field" name="displayName" placeholder="Name (optional)" />
      {status ? <p className="muted">{status}</p> : null}
      <button className="btn btn-primary" type="submit">
        Invite
      </button>
    </form>
  );
}

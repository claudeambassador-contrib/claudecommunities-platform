import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import {
  listConnections,
  respondToConnection,
} from "@/modules/connections/services/connectionsService";
import { listDirectory } from "@/modules/identity/services/usersService";
import { requireCityActor } from "@/shared/http/cityPage";
import { guardedMutation } from "@/shared/http/guarded";
import { EmptyCard, PageHeader, SignInCard } from "@/shared/ui/page";
import { useFormSubmit } from "@/shared/ui/use-form-submit";

const loadInput = z.object({ citySlug: z.string().min(1) });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
  .handler(async ({ data }) => {
    const page = await requireCityActor(data.citySlug);
    if (!page.ok) {
      return { signedIn: false as const };
    }
    const [accepted, pending, directory] = await Promise.all([
      listConnections(page.store, page.actor, { status: "accepted" }),
      listConnections(page.store, page.actor, { filter: "received", status: "pending" }),
      listDirectory(page.registry, page.actor, page.tenant.orgId, { limit: 100 }),
    ]);
    const names = new Map(
      (directory.ok ? directory.users : []).map((user) => [
        user.id,
        user.displayName?.trim() || "Member",
      ]),
    );
    const otherOf = (requesterId: string, receiverId: string) =>
      requesterId === page.actor.id ? receiverId : requesterId;
    return {
      signedIn: true as const,
      connections: accepted.ok
        ? accepted.connections.map((item) => {
            const otherId = otherOf(item.requesterId, item.receiverId);
            return { id: item.id, name: names.get(otherId) ?? otherId };
          })
        : [],
      pending: pending.ok
        ? pending.connections.map((item) => ({
            id: item.id,
            name: names.get(item.requesterId) ?? item.requesterId,
          }))
        : [],
    };
  });

const respondInput = z.object({
  citySlug: z.string().min(1),
  connectionId: z.string(),
  status: z.enum(["accepted", "rejected"]),
});

const respond = createServerFn({ method: "POST" })
  .validator((input: unknown) => respondInput.parse(input))
  .handler(({ data }) =>
    guardedMutation(data.citySlug, null, (page) =>
      respondToConnection(page.store, page.actor, data.connectionId, data.status),
    ),
  );

function RespondForm({
  citySlug,
  connectionId,
  status,
}: {
  citySlug: string;
  connectionId: string;
  status: "accepted" | "rejected";
}): ReactElement {
  const { error, handleSubmit, pending } = useFormSubmit({
    submit: () => respond({ data: { citySlug, connectionId, status } }),
  });
  const label = status === "accepted" ? "Accept" : "Reject";
  const buttonLabel = pending ? "Saving…" : label;

  return (
    <form onSubmit={handleSubmit}>
      <button
        className={status === "accepted" ? "btn btn-primary" : "btn"}
        disabled={pending}
        type="submit"
      >
        {buttonLabel}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}

export const Route = createFileRoute("/$citySlug/community/connections")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: ConnectionsPage,
});

function ConnectionsPage(): ReactElement {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.signedIn) {
    return <SignInCard href="/login" />;
  }

  return (
    <section className="stack">
      <PageHeader subtitle="People you are connected with" title="Connections" />
      {data.pending.length > 0 ? (
        <div className="stack">
          <h3 className="m-0">Pending requests</h3>
          {data.pending.map((item) => (
            <article className="card row justify-between" key={item.id}>
              <strong>{item.name}</strong>
              <div className="row">
                <RespondForm citySlug={citySlug} connectionId={item.id} status="accepted" />
                <RespondForm citySlug={citySlug} connectionId={item.id} status="rejected" />
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {data.connections.length === 0 ? (
        <EmptyCard>No connections yet.</EmptyCard>
      ) : (
        data.connections.map((item) => (
          <article className="card" key={item.id}>
            <strong>{item.name}</strong>
          </article>
        ))
      )}
    </section>
  );
}

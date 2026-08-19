import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { FormEvent } from "react";
import {
  listConnections,
  respondToConnection,
} from "@/modules/connections/services/connectionsService";
import { listDirectory } from "@/modules/identity/services/usersService";
import { requireCityActor } from "@/shared/http/cityPage";
import { EmptyCard, PageHeader, SignInCard } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
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

const respond = createServerFn({ method: "POST" })
  .validator(
    (d: { citySlug: string; connectionId: string; status: "accepted" | "rejected" }) => d,
  )
  .handler(async ({ data }) => {
    const page = await requireCityActor(data.citySlug);
    if (!page.ok) {
      return { ok: false as const };
    }
    const result = await respondToConnection(
      page.store,
      page.actor,
      data.connectionId,
      data.status,
    );
    return { ok: result.ok };
  });

async function handleRespond(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const citySlug = String(form.get("citySlug") ?? "");
  const connectionId = String(form.get("connectionId") ?? "");
  const status = String(form.get("status") ?? "");
  if (status !== "accepted" && status !== "rejected") {
    return;
  }
  await respond({ data: { citySlug, connectionId, status } });
  window.location.reload();
}

export const Route = createFileRoute("/$citySlug/community/connections")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: ConnectionsPage,
});

function ConnectionsPage() {
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
          <h3 style={{ margin: 0 }}>Pending requests</h3>
          {data.pending.map((item) => (
            <article className="card row" key={item.id} style={{ justifyContent: "space-between" }}>
              <strong>{item.name}</strong>
              <div className="row">
                <form onSubmit={handleRespond}>
                  <input name="citySlug" type="hidden" value={citySlug} />
                  <input name="connectionId" type="hidden" value={item.id} />
                  <input name="status" type="hidden" value="accepted" />
                  <button className="btn btn-primary" type="submit">
                    Accept
                  </button>
                </form>
                <form onSubmit={handleRespond}>
                  <input name="citySlug" type="hidden" value={citySlug} />
                  <input name="connectionId" type="hidden" value={item.id} />
                  <input name="status" type="hidden" value="rejected" />
                  <button className="btn" type="submit">
                    Reject
                  </button>
                </form>
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

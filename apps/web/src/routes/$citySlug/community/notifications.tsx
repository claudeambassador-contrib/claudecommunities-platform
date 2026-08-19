import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { FormEvent } from "react";
import {
  listNotifications,
  markAllRead,
} from "@/modules/notifications/services/notificationsService";
import { requireCityActor } from "@/shared/http/cityPage";
import { ItemList, PageHeader, SignInCard } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await requireCityActor(data.citySlug);
    if (!page.ok) {
      return { signedIn: false as const };
    }
    const result = await listNotifications(page.store, page.actor);
    return {
      signedIn: true as const,
      notifications: result.ok
        ? result.notifications.map((item) => ({
            createdAt: item.createdAt,
            id: item.id,
            message: item.payload.message,
            readAt: item.readAt,
            title: item.payload.title,
          }))
        : [],
      unreadCount: result.ok ? result.unreadCount : 0,
    };
  });

const markRead = createServerFn({ method: "POST" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await requireCityActor(data.citySlug);
    if (!page.ok) {
      return { ok: false as const };
    }
    await markAllRead(page.store, page.actor);
    return { ok: true as const };
  });

async function handleMarkRead(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const citySlug = String(new FormData(event.currentTarget).get("citySlug") ?? "");
  await markRead({ data: { citySlug } });
  window.location.reload();
}

export const Route = createFileRoute("/$citySlug/community/notifications")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.signedIn) {
    return <SignInCard href="/login" />;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          data.unreadCount > 0 ? (
            <form onSubmit={handleMarkRead}>
              <input name="citySlug" type="hidden" value={citySlug} />
              <button className="btn" type="submit">
                Mark all read
              </button>
            </form>
          ) : null
        }
        subtitle={data.unreadCount > 0 ? `${data.unreadCount} unread` : "You're all caught up"}
        title="Notifications"
      />
      <ItemList
        empty="No notifications yet."
        items={data.notifications.map((item) => ({
          detail: `${item.message} · ${new Date(item.createdAt).toLocaleString()}${
            item.readAt ? "" : " · unread"
          }`,
          id: item.id,
          title: item.title,
        }))}
      />
    </section>
  );
}

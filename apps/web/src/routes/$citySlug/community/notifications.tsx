import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import {
  listNotifications,
  markAllRead,
} from "@/modules/notifications/services/notificationsService";
import { cityInput, cityMutationHandler } from "@/shared/http/cityFn";
import { requireCityActor } from "@/shared/http/cityPage";
import { ItemList, PageHeader, SignInCard } from "@/shared/ui/page";
import { useFormSubmit } from "@/shared/ui/use-form-submit";

const loadInput = z.object({ citySlug: z.string().min(1) });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
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

const markReadInput = cityInput();

const markRead = createServerFn({ method: "POST" })
  .validator((input: unknown) => markReadInput.parse(input))
  .handler(cityMutationHandler((page) => markAllRead(page.store, page.actor)));

function MarkAllReadForm({ citySlug }: { citySlug: string }): ReactElement {
  const { error, handleSubmit, pending } = useFormSubmit({
    submit: () => markRead({ data: { citySlug } }),
  });

  return (
    <form onSubmit={handleSubmit}>
      <button className="btn" disabled={pending} type="submit">
        {pending ? "Saving…" : "Mark all read"}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}

export const Route = createFileRoute("/$citySlug/community/notifications")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: NotificationsPage,
});

function NotificationsPage(): ReactElement {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.signedIn) {
    return <SignInCard href="/login" />;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={data.unreadCount > 0 ? <MarkAllReadForm citySlug={citySlug} /> : null}
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

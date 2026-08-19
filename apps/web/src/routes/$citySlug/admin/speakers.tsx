import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listTalkSubmissions } from "@/modules/talks/services/talksService";
import { ensurePermission } from "@/shared/auth/actor";
import { loadCityPage } from "@/shared/http/cityPage";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadSpeakers = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    const view = ensurePermission(page.actor, "speakers.view");
    if (!view.ok) {
      return { allowed: false as const, reason: view.error.code };
    }
    const talks = await listTalkSubmissions(page.store, page.actor);
    return {
      allowed: true as const,
      talks: talks.ok
        ? talks.talks.map((talk) => ({
            detail: `${talk.status} · ${talk.name}`,
            id: talk.id,
            title: talk.title || talk.name,
          }))
        : [],
    };
  });

export const Route = createFileRoute("/$citySlug/admin/speakers")({
  loader: ({ params }) => loadSpeakers({ data: { citySlug: params.citySlug } }),
  component: AdminSpeakersPage,
});

function AdminSpeakersPage() {
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Speakers" />;
  }

  return (
    <section className="stack">
      <PageHeader subtitle="Talk submissions" title="Speakers" />
      <ItemList empty="No talk submissions yet." items={data.talks} />
    </section>
  );
}

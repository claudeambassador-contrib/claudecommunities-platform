import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { listTalkSubmissions } from "@/modules/talks/services/talksService";
import { ok } from "@/shared/http/errors";
import { guarded } from "@/shared/http/guarded";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadSpeakersInput = z.object({ citySlug: z.string().min(1) });

const loadSpeakers = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadSpeakersInput.parse(input))
  .handler(({ data }) =>
    guarded(data.citySlug, "speakers.view", async (page) => {
      const talks = await listTalkSubmissions(page.store, page.actor);
      return ok({
        talks: talks.ok
          ? talks.talks.map((talk) => ({
              detail: `${talk.status} · ${talk.name}`,
              id: talk.id,
              title: talk.title || talk.name,
            }))
          : [],
      });
    }),
  );

export const Route = createFileRoute("/$citySlug/admin/speakers")({
  loader: ({ params }) => loadSpeakers({ data: { citySlug: params.citySlug } }),
  component: AdminSpeakersPage,
});

function AdminSpeakersPage(): ReactElement {
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

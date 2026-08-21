import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";

import { getTalk } from "@/modules/talks/services/talksService";
import { requireCityActor } from "@/shared/http/cityPage";
import { DeniedCard, EmptyCard, PageHeader, SignInCard } from "@/shared/ui/page";

interface TalkView {
  bio: string | null;
  city: string | null;
  description: string | null;
  email: string;
  id: string;
  name: string;
  slidesUrl: string | null;
  status: string;
  title: string;
}

const loadInput = z.object({ citySlug: z.string().min(1), id: z.string() });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
  .handler(async ({ data }) => {
    const page = await requireCityActor(data.citySlug);
    if (!page.ok) {
      return { status: "unauthenticated" as const, talk: null as TalkView | null };
    }
    const found = await getTalk(page.store, page.actor, data.id);
    if (!found.ok) {
      if (found.error.status === 403) {
        return {
          status: "denied" as const,
          talk: null as TalkView | null,
          reason: found.error.message ?? "You cannot view this talk.",
        };
      }
      return { status: "missing" as const, talk: null as TalkView | null };
    }
    return {
      status: "ok" as const,
      talk: {
        bio: found.talk.bio,
        city: found.talk.city,
        description: found.talk.description,
        email: found.talk.email,
        id: found.talk.id,
        name: found.talk.name,
        slidesUrl: found.talk.slidesUrl,
        status: found.talk.status,
        title: found.talk.title,
      },
    };
  });

export const Route = createFileRoute("/$citySlug/my-talks/$id")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug, id: params.id } }),
  component: Page,
});

function Page(): ReactElement {
  const { tenant } = Route.useRouteContext();
  const data = Route.useLoaderData();

  if (data.status === "unauthenticated") {
    return <SignInCard href="/login" />;
  }
  if (data.status === "denied") {
    return <DeniedCard reason={data.reason} />;
  }
  if (data.status === "missing" || !data.talk) {
    return <EmptyCard>Talk not found.</EmptyCard>;
  }

  const { talk } = data;

  return (
    <section className="stack">
      <PageHeader
        actions={
          <a className="btn" href={`/${tenant.slug}/my-talks`}>
            My talks
          </a>
        }
        subtitle={`${talk.status} · ${talk.name}`}
        title={talk.title}
      />
      <div className="card stack">
        <p className="muted m-0">
          {talk.email}
          {talk.city ? ` · ${talk.city}` : ""}
        </p>
        <p className="m-0 whitespace-pre-wrap">{talk.description ?? "No description yet."}</p>
        {talk.bio ? <p className="muted m-0 whitespace-pre-wrap">{talk.bio}</p> : null}
        {talk.slidesUrl ? (
          <a href={talk.slidesUrl} rel="noreferrer">
            Slides
          </a>
        ) : (
          <p className="muted m-0">No slides uploaded.</p>
        )}
      </div>
    </section>
  );
}

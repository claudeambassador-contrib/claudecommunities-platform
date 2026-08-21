import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";

import { listBookmarks } from "@/modules/community/services/communityService";
import { requireCityActor } from "@/shared/http/cityPage";
import { ItemList, PageHeader, SignInCard } from "@/shared/ui/page";

const loadInput = z.object({ citySlug: z.string().min(1) });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
  .handler(async ({ data }) => {
    const page = await requireCityActor(data.citySlug);
    if (!page.ok) {
      return { signedIn: false as const };
    }
    const bookmarks = await listBookmarks(page.store, page.actor);
    return {
      signedIn: true as const,
      posts: bookmarks.ok
        ? bookmarks.posts.map((post) => ({
            id: post.id,
            title: post.title?.trim() || post.content.slice(0, 80) || "Untitled post",
          }))
        : [],
    };
  });

export const Route = createFileRoute("/$citySlug/community/bookmarks")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: BookmarksPage,
});

function BookmarksPage(): ReactElement {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.signedIn) {
    return <SignInCard href="/login" />;
  }

  return (
    <section className="stack">
      <PageHeader subtitle="Posts you saved" title="Bookmarks" />
      <ItemList
        empty="No bookmarks yet."
        items={data.posts.map((post) => ({
          href: `/${citySlug}/community/posts/${post.id}`,
          id: post.id,
          title: post.title,
        }))}
      />
    </section>
  );
}

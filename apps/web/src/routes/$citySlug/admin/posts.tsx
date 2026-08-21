import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";

import { listFeed } from "@/modules/community/services/communityService";
import { cityHandler, cityInput } from "@/shared/http/cityFn";
import { ok } from "@/shared/http/errors";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadPostsInput = cityInput();

const loadPosts = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadPostsInput.parse(input))
  .handler(
    cityHandler(async (page) => {
      const result = await listFeed(page.store);
      if (!result.ok) {
        return result;
      }
      return ok({
        posts: result.posts.map((post) => ({
          detail: new Date(post.createdAt).toLocaleString(),
          id: post.id,
          title: post.title || post.content.slice(0, 80) || "Untitled post",
        })),
      });
    }, "posts.view"),
  );

export const Route = createFileRoute("/$citySlug/admin/posts")({
  loader: ({ params }) => loadPosts({ data: { citySlug: params.citySlug } }),
  component: AdminPostsPage,
});

function AdminPostsPage(): ReactElement {
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Posts" />;
  }

  return (
    <section className="stack">
      <PageHeader title="Posts" />
      <ItemList empty="No posts yet." items={data.posts} />
    </section>
  );
}

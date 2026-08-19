import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listFeed } from "@/modules/community/services/communityService";
import { ensurePermission } from "@/shared/auth/actor";
import { loadCityPage } from "@/shared/http/cityPage";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadPosts = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    const perm = ensurePermission(page.actor, "posts.view");
    if (!perm.ok) {
      return { allowed: false as const, reason: perm.error.code };
    }
    const result = await listFeed(page.store);
    if (!result.ok) {
      return { allowed: false as const, reason: result.error.code };
    }
    return {
      allowed: true as const,
      posts: result.posts.map((post) => ({
        detail: new Date(post.createdAt).toLocaleString(),
        id: post.id,
        title: post.title || post.content.slice(0, 80) || "Untitled post",
      })),
    };
  });

export const Route = createFileRoute("/$citySlug/admin/posts")({
  loader: ({ params }) => loadPosts({ data: { citySlug: params.citySlug } }),
  component: AdminPostsPage,
});

function AdminPostsPage() {
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

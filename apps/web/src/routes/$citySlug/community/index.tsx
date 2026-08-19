import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useCallback } from "react";
import { createCityPost, loadCommunityFeed } from "@/modules/community/services/postsService";
import type { FeedCard, FeedSpaceOption } from "@/modules/community/types";
import { EmptyCard, PageHeader, SignInCard } from "@/shared/ui/page";
import { PostCard } from "@/shared/ui/post-card";
import { PostComposer } from "@/shared/ui/post-composer";

const getFeed = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const result = await loadCommunityFeed(data.citySlug);
    if (!result.ok) {
      return {
        posts: [] as FeedCard[],
        signedIn: false,
        spaces: [] as FeedSpaceOption[],
      };
    }
    return result;
  });

const submitPost = createServerFn({ method: "POST" })
  .validator((d: { citySlug: string; content: string; spaceId: string; title?: string }) => d)
  .handler(async ({ data }) => {
    const result = await createCityPost(data.citySlug, {
      content: data.content,
      spaceId: data.spaceId,
      title: data.title,
    });
    if (!result.ok) {
      return { error: result.error.message ?? result.error.code, ok: false as const };
    }
    return { ok: true as const };
  });

export const Route = createFileRoute("/$citySlug/community/")({
  loader: ({ params }) => getFeed({ data: { citySlug: params.citySlug } }),
  component: CommunityPage,
});

function CommunityPage() {
  const { citySlug } = Route.useParams();
  const { posts, signedIn, spaces } = Route.useLoaderData();

  const handleCreate = useCallback(
    async (input: { citySlug: string; content: string; spaceId: string; title?: string }) =>
      submitPost({ data: input }),
    [],
  );

  return (
    <section className="stack">
      <PageHeader subtitle="Posts in this city" title="Feed" />
      {signedIn ? (
        <PostComposer citySlug={citySlug} onSubmit={handleCreate} spaces={spaces} />
      ) : (
        <SignInCard href="/login" />
      )}
      {posts.length === 0 ? (
        <EmptyCard>No posts yet.</EmptyCard>
      ) : (
        posts.map((post) => <PostCard citySlug={citySlug} key={post.id} post={post} />)
      )}
    </section>
  );
}

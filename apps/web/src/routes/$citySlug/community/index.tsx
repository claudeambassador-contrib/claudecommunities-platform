import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { useCallback } from "react";
import { z } from "zod";
import { createCityPost, loadCommunityFeed } from "@/modules/community/services/postsService";
import type { FeedCard, FeedSpaceOption } from "@/modules/community/types";
import { guardedMutation } from "@/shared/http/guarded";
import { EmptyCard, PageHeader, SignInCard } from "@/shared/ui/page";
import { PostCard } from "@/shared/ui/post-card";
import { PostComposer } from "@/shared/ui/post-composer";

const getFeedInput = z.object({ citySlug: z.string().min(1) });

const getFeed = createServerFn({ method: "GET" })
  .validator((input: unknown) => getFeedInput.parse(input))
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

const submitPostInput = z.object({
  citySlug: z.string().min(1),
  content: z.string(),
  spaceId: z.string(),
  title: z.string().optional(),
});

const submitPost = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitPostInput.parse(input))
  .handler(({ data }) =>
    guardedMutation(data.citySlug, null, () =>
      createCityPost(data.citySlug, {
        content: data.content,
        spaceId: data.spaceId,
        title: data.title,
      }),
    ),
  );

export const Route = createFileRoute("/$citySlug/community/")({
  loader: ({ params }) => getFeed({ data: { citySlug: params.citySlug } }),
  staleTime: 30_000,
  component: CommunityPage,
});

function CommunityPage(): ReactElement {
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

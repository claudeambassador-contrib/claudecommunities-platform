import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listPosts } from "@/modules/community/services/postsService";

const getPosts = createServerFn({ method: "GET" })
  .inputValidator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const result = await listPosts(data.citySlug);
    if (!result.ok) return { posts: [] as { id: string; body: string; createdAt: Date }[] };
    return {
      posts: result.posts.map((p) => ({
        id: p.id,
        body: p.body,
        createdAt: p.createdAt,
      })),
    };
  });

export const Route = createFileRoute("/$citySlug/community/")({
  loader: ({ params }) => getPosts({ data: { citySlug: params.citySlug } }),
  component: CommunityPage,
});

function CommunityPage() {
  const { posts } = Route.useLoaderData();

  return (
    <section className="stack">
      <h2 style={{ margin: 0 }}>Community</h2>
      {posts.length === 0 ? (
        <div className="card muted">No posts yet. Sign in to create one.</div>
      ) : (
        posts.map((p) => (
          <article key={p.id} className="card">
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{p.body}</p>
            <div className="muted" style={{ marginTop: "0.5rem" }}>
              {new Date(p.createdAt).toLocaleString()}
            </div>
          </article>
        ))
      )}
    </section>
  );
}

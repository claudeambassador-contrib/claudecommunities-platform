import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { getPost, listComments } from "@/modules/community/services/communityService";
import type { CommentNode } from "@/modules/community/types";
import { loadCityPage } from "@/shared/http/cityPage";
import { EmptyCard, PageHeader } from "@/shared/ui/page";

interface CommentJson {
  content: string;
  createdAt: string;
  id: string;
  replies: CommentJson[];
}

const loadInput = z.object({ citySlug: z.string().min(1), id: z.string() });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return { comments: [] as CommentJson[], post: null };
    }
    const found = await getPost(page.store, data.id, page.actor);
    if (!found.ok) {
      return { comments: [] as CommentJson[], post: null };
    }
    const comments = await listComments(page.store, data.id);
    const toJson = (node: CommentNode): CommentJson => ({
      content: node.content,
      createdAt: node.createdAt,
      id: node.id,
      replies: node.replies.map(toJson),
    });
    return {
      comments: comments.ok ? comments.comments.map(toJson) : [],
      post: {
        content: found.post.content,
        createdAt: found.post.createdAt,
        id: found.post.id,
        title: found.post.title,
      },
    };
  });

export const Route = createFileRoute("/$citySlug/community/posts/$id")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug, id: params.id } }),
  component: PostPage,
});

function CommentList({ comments }: { comments: CommentJson[] }): ReactElement {
  if (comments.length === 0) {
    return <EmptyCard>No comments yet.</EmptyCard>;
  }
  return (
    <div className="stack">
      {comments.map((comment) => (
        <article className="card stack" key={comment.id}>
          <p className="m-0 whitespace-pre-wrap">{comment.content}</p>
          <div className="muted">{new Date(comment.createdAt).toLocaleString()}</div>
          {comment.replies.length > 0 ? <CommentList comments={comment.replies} /> : null}
        </article>
      ))}
    </div>
  );
}

function PostPage(): ReactElement {
  const { comments, post } = Route.useLoaderData();

  if (!post) {
    return <EmptyCard>Post not found.</EmptyCard>;
  }

  return (
    <section className="stack">
      <PageHeader
        subtitle={new Date(post.createdAt).toLocaleString()}
        title={post.title?.trim() || "Post"}
      />
      <div className="card">
        <p className="m-0 whitespace-pre-wrap">{post.content}</p>
      </div>
      <h3 className="m-0">Comments</h3>
      <CommentList comments={comments} />
    </section>
  );
}

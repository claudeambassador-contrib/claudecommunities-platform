import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import type { FeedCard } from "@/modules/community/types";
import { Avatar } from "@/shared/ui/avatar";
import { RemoteImage } from "@/shared/ui/remote-image";
import { formatTimeAgo } from "@/shared/ui/timeAgo";

export interface PostCardProps {
  citySlug: string;
  post: FeedCard;
}

function truncate(content: string, max = 280): { more: boolean; text: string } {
  if (content.length <= max) {
    return { more: false, text: content };
  }
  const cut = content.slice(0, max).trimEnd();
  const lastSpace = cut.lastIndexOf(" ");
  return {
    more: true,
    text: `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`,
  };
}

export function PostCard({ citySlug, post }: PostCardProps): ReactElement {
  const body = truncate(post.content);
  const profile = { citySlug, id: post.author.id };
  const detail = { citySlug, id: post.id };

  return (
    <article className="post-card">
      <div className="post-card-meta">
        <Link params={profile} to="/$citySlug/community/profile/$id">
          <Avatar
            className="size-10 rounded-full"
            fallbackClassName="bg-gradient-to-br from-accent to-accent-deep text-white font-bold"
            name={post.author.name}
            src={post.author.imageUrl}
          />
        </Link>
        <div>
          <Link params={profile} to="/$citySlug/community/profile/$id">
            <strong>{post.author.name}</strong>
          </Link>
          <div className="muted">
            {post.space ? `${post.space.name} · ` : null}
            {formatTimeAgo(post.createdAt)}
            {post.isPinned ? " · Pinned" : null}
          </div>
        </div>
      </div>
      {post.title?.trim() ? (
        <Link params={detail} to="/$citySlug/community/posts/$id">
          <h3 className="post-card-title">{post.title}</h3>
        </Link>
      ) : null}
      <p className="post-card-body">{body.text}</p>
      {post.mediaType === "image" && post.mediaUrl ? (
        <RemoteImage alt="" className="post-card-media" src={post.mediaUrl} />
      ) : null}
      <div className="post-card-footer">
        <Link params={detail} to="/$citySlug/community/posts/$id">
          {post.commentCount} comments
        </Link>
        <span className="muted">{post.reactionCount} reactions</span>
        {body.more ? (
          <Link params={detail} to="/$citySlug/community/posts/$id">
            Read more
          </Link>
        ) : null}
      </div>
    </article>
  );
}

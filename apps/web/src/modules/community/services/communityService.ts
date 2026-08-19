// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as communityRepo from "@/modules/community/repositories/communityRepository";
import type {
  Clock,
  CommentNode,
  CreateCommentBody,
  PostCreateBody,
  PostDetail,
  PostUpdateBody,
  ReactionSummary,
  SpaceCreateBody,
  SpaceDetail,
} from "@/modules/community/types";
import type { Actor } from "@/shared/auth/actor";
import { ensureOwnerOrPermission, ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";
import { toSafeSlug } from "@/shared/ids";

async function uniqueSpaceSlug(store: TenantStore, base: string): Promise<string> {
  let candidate = base;
  let n = 1;
  // biome-ignore lint/performance/noAwaitInLoops: uniqueness is checked one slug at a time
  while (await communityRepo.findSpaceBySlug(store, candidate)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

export async function listSpaces(store: TenantStore): Promise<Result<{ spaces: SpaceDetail[] }>> {
  return ok({ spaces: await communityRepo.listSpaces(store) });
}

export async function createSpace(
  store: TenantStore,
  actor: Actor,
  input: SpaceCreateBody,
): Promise<Result<{ space: SpaceDetail }>> {
  const perm = ensurePermission(actor, "posts.edit");
  if (!perm.ok) {
    return perm;
  }
  if (!input.name.trim()) {
    return err("bad_request", 400, "name required");
  }
  const slug = await uniqueSpaceSlug(store, toSafeSlug(input.slug ?? input.name));
  return ok({
    space: await communityRepo.insertSpace(store, {
      color: input.color,
      description: input.description,
      icon: input.icon,
      name: input.name.trim(),
      slug,
    }),
  });
}

export async function listFeed(
  store: TenantStore,
  options: { spaceSlug?: string | null; viewer?: Actor | null } = {},
): Promise<Result<{ posts: PostDetail[] }>> {
  return ok({
    posts: await communityRepo.listPosts(store, {
      spaceSlug: options.spaceSlug,
      viewerId: options.viewer?.id,
    }),
  });
}

export async function getPost(
  store: TenantStore,
  id: string,
  viewer?: Actor | null,
): Promise<Result<{ post: PostDetail }>> {
  return await communityRepo.getPost(store, id, viewer?.id);
}

export async function createPost(
  store: TenantStore,
  actor: Actor,
  input: PostCreateBody,
): Promise<Result<{ post: PostDetail }>> {
  if (!input.content.trim()) {
    return err("bad_request", 400, "Content is required");
  }
  if (!input.spaceId) {
    return err("bad_request", 400, "Space is required");
  }
  const space = await communityRepo.getSpace(store, input.spaceId);
  if (!space) {
    return err("not_found", 404, "Space not found");
  }
  return ok({
    post: await communityRepo.insertPost(store, {
      authorUserId: actor.id,
      body: input.content.trim(),
      mediaType: input.mediaType,
      mediaUrl: input.mediaUrl,
      spaceId: input.spaceId,
      title: input.title,
    }),
  });
}

export async function updatePost(
  store: TenantStore,
  actor: Actor,
  id: string,
  input: PostUpdateBody,
): Promise<Result<{ post: PostDetail }>> {
  const existing = await communityRepo.getPost(store, id);
  if (!existing.ok) {
    return existing;
  }
  const allowed = ensureOwnerOrPermission(actor, existing.post.authorId, "posts.edit");
  if (!allowed.ok) {
    return allowed;
  }
  if (input.content !== undefined && !input.content?.trim()) {
    return err("bad_request", 400, "Content is required");
  }
  if (input.spaceId) {
    const space = await communityRepo.getSpace(store, input.spaceId);
    if (!space) {
      return err("not_found", 404, "Space not found");
    }
  }
  return communityRepo.updatePost(
    store,
    id,
    {
      ...(input.content === undefined ? {} : { body: input.content.trim() }),
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.spaceId === undefined ? {} : { spaceId: input.spaceId }),
      ...(input.removeImage
        ? { mediaType: null, mediaUrl: null }
        : {
            ...(input.mediaUrl === undefined ? {} : { mediaUrl: input.mediaUrl }),
            ...(input.mediaType === undefined ? {} : { mediaType: input.mediaType }),
          }),
    },
    actor.id,
  );
}

export async function setPostPin(
  store: TenantStore,
  actor: Actor,
  id: string,
  isPinned: boolean,
): Promise<Result<{ post: PostDetail }>> {
  const perm = ensurePermission(actor, "posts.edit");
  if (!perm.ok) {
    return perm;
  }
  return await communityRepo.updatePost(store, id, { isPinned }, actor.id);
}

export async function deletePost(
  store: TenantStore,
  actor: Actor,
  id: string,
): Promise<Result<{ success: true }>> {
  const existing = await communityRepo.getPost(store, id);
  if (!existing.ok) {
    return existing;
  }
  const allowed = ensureOwnerOrPermission(actor, existing.post.authorId, "posts.delete");
  if (!allowed.ok) {
    return allowed;
  }
  return communityRepo.deletePost(store, id);
}

export async function listComments(
  store: TenantStore,
  postId: string,
): Promise<Result<{ comments: CommentNode[] }>> {
  const post = await communityRepo.getPost(store, postId);
  if (!post.ok) {
    return post;
  }
  return ok({ comments: await communityRepo.listComments(store, postId) });
}

export async function createComment(
  store: TenantStore,
  actor: Actor,
  input: CreateCommentBody,
): Promise<Result<{ comment: CommentNode }>> {
  if (!input.content.trim()) {
    return err("bad_request", 400, "Content is required");
  }
  const post = await communityRepo.getPost(store, input.postId);
  if (!post.ok) {
    return post;
  }
  if (input.parentId) {
    const parent = await communityRepo.getComment(store, input.parentId);
    if (!parent || parent.postId !== input.postId) {
      return err("bad_request", 400, "Parent comment not found");
    }
  }
  return ok({
    comment: await communityRepo.insertComment(store, {
      authorUserId: actor.id,
      body: input.content.trim(),
      parentId: input.parentId,
      postId: input.postId,
    }),
  });
}

export async function updateComment(
  store: TenantStore,
  actor: Actor,
  id: string,
  content: string,
): Promise<Result<{ comment: CommentNode }>> {
  const existing = await communityRepo.getComment(store, id);
  if (!existing) {
    return err("not_found", 404, "Comment not found");
  }
  const allowed = ensureOwnerOrPermission(actor, existing.authorUserId, "posts.edit");
  if (!allowed.ok) {
    return allowed;
  }
  if (!content.trim()) {
    return err("bad_request", 400, "Content is required");
  }
  return communityRepo.updateComment(store, id, content.trim());
}

export async function deleteComment(
  store: TenantStore,
  actor: Actor,
  id: string,
): Promise<Result<{ success: true }>> {
  const existing = await communityRepo.getComment(store, id);
  if (!existing) {
    return err("not_found", 404, "Comment not found");
  }
  const allowed = ensureOwnerOrPermission(actor, existing.authorUserId, "posts.delete");
  if (!allowed.ok) {
    return allowed;
  }
  return communityRepo.deleteComment(store, id);
}

export async function togglePostReaction(
  store: TenantStore,
  actor: Actor,
  postId: string,
  emoji: string,
): Promise<Result<{ reacted: boolean }>> {
  if (!emoji) {
    return err("bad_request", 400, "Emoji required");
  }
  const post = await communityRepo.getPost(store, postId);
  if (!post.ok) {
    return post;
  }
  return ok({
    reacted: await communityRepo.toggleReaction(
      store,
      "reactions",
      "postId",
      postId,
      actor.id,
      emoji,
    ),
  });
}

export async function listPostReactions(
  store: TenantStore,
  postId: string,
  viewerId: string | null,
): Promise<Result<{ reactions: ReactionSummary[] }>> {
  const post = await communityRepo.getPost(store, postId);
  if (!post.ok) {
    return post;
  }
  return ok({
    reactions: await communityRepo.listReactions(store, "reactions", "postId", postId, viewerId),
  });
}

export async function toggleCommentReaction(
  store: TenantStore,
  actor: Actor,
  commentId: string,
  emoji: string,
): Promise<Result<{ reacted: boolean }>> {
  if (!emoji) {
    return err("bad_request", 400, "Emoji required");
  }
  const comment = await communityRepo.getComment(store, commentId);
  if (!comment) {
    return err("not_found", 404, "Comment not found");
  }
  return ok({
    reacted: await communityRepo.toggleReaction(
      store,
      "commentReactions",
      "commentId",
      commentId,
      actor.id,
      emoji,
    ),
  });
}

export async function listCommentReactions(
  store: TenantStore,
  commentId: string,
  viewerId: string | null,
): Promise<Result<{ reactions: ReactionSummary[] }>> {
  const comment = await communityRepo.getComment(store, commentId);
  if (!comment) {
    return err("not_found", 404, "Comment not found");
  }
  return ok({
    reactions: await communityRepo.listReactions(
      store,
      "commentReactions",
      "commentId",
      commentId,
      viewerId,
    ),
  });
}

export async function togglePostLike(
  store: TenantStore,
  actor: Actor,
  postId: string,
): Promise<Result<{ liked: boolean }>> {
  const post = await communityRepo.getPost(store, postId);
  if (!post.ok) {
    return post;
  }
  return ok({ liked: await communityRepo.toggleLike(store, postId, actor.id) });
}

export async function togglePostBookmark(
  store: TenantStore,
  actor: Actor,
  postId: string,
): Promise<Result<{ isBookmarked: boolean }>> {
  const post = await communityRepo.getPost(store, postId);
  if (!post.ok) {
    return post;
  }
  return ok({ isBookmarked: await communityRepo.toggleBookmark(store, postId, actor.id) });
}

export async function listBookmarks(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ posts: PostDetail[] }>> {
  const feed = await listFeed(store, { viewer: actor });
  if (!feed.ok) {
    return feed;
  }
  return ok({ posts: feed.posts.filter((post) => post.isBookmarked) });
}

export async function unreadCounts(
  store: TenantStore,
  actor: Actor,
  clock: Clock = { now: () => new Date() },
): Promise<Result<{ counts: Record<string, number> }>> {
  const spaces = await communityRepo.listSpaces(store);
  const fallback = new Date(clock.now().getTime() - 7 * 24 * 60 * 60 * 1000);
  const entries = await Promise.all(
    spaces.map(async (space) => {
      const viewedAt = await communityRepo.getSpaceViewedAt(store, space.id, actor.id);
      const n = await communityRepo.unreadCountForSpace(
        store,
        space.id,
        actor.id,
        viewedAt ?? fallback,
      );
      return [space.id, n] as const;
    }),
  );
  const counts: Record<string, number> = {};
  for (const [spaceId, n] of entries) {
    if (n > 0) {
      counts[spaceId] = n;
    }
  }
  return ok({ counts });
}

export async function markSpaceViewed(
  store: TenantStore,
  actor: Actor,
  spaceId: string,
  clock: Clock = { now: () => new Date() },
): Promise<Result<{ success: true }>> {
  const space = await communityRepo.getSpace(store, spaceId);
  if (!space) {
    return err("not_found", 404, "Space not found");
  }
  await communityRepo.upsertSpaceView(store, spaceId, actor.id, clock.now());
  return ok({ success: true });
}

import { createPost, listFeed, listSpaces } from "@/modules/community/services/communityService";
import type { FeedCard, FeedSpaceOption, PostDetail } from "@/modules/community/types";
import { listPublicAuthors } from "@/modules/identity/services/usersService";
import { resolveCityContext } from "@/modules/tenants/services/resolveCityService";
import { openTenantStore } from "@/shared/db/env";
import { loadCityPage, requireCityActor } from "@/shared/http/cityPage";
import { ok, type Result } from "@/shared/http/errors";

export async function listPosts(citySlug: string): Promise<Result<{ posts: PostDetail[] }>> {
  const city = await resolveCityContext(citySlug);
  if (!city.ok) {
    return city;
  }
  return listFeed(openTenantStore(city.tenant));
}

export async function loadCommunityFeed(citySlug: string): Promise<
  Result<{
    posts: FeedCard[];
    signedIn: boolean;
    spaces: FeedSpaceOption[];
  }>
> {
  const page = await loadCityPage(citySlug);
  if (!page.ok) {
    return page;
  }
  const feed = await listFeed(page.store, { viewer: page.actor });
  if (!feed.ok) {
    return feed;
  }
  const spacesResult = await listSpaces(page.store);
  const authors = await listPublicAuthors(
    page.registry,
    feed.posts.map((post) => post.authorId),
  );
  const authorById = new Map(authors.authors.map((author) => [author.id, author]));
  return ok({
    posts: feed.posts.map((post) => ({
      author: authorById.get(post.authorId) ?? {
        id: post.authorId,
        imageUrl: null,
        name: "Member",
      },
      commentCount: post.commentCount,
      content: post.content,
      createdAt: post.createdAt,
      id: post.id,
      isPinned: post.isPinned,
      mediaType: post.mediaType,
      mediaUrl: post.mediaUrl,
      reactionCount: post.reactionCount,
      space: post.space ? { color: post.space.color, name: post.space.name } : null,
      title: post.title,
    })),
    signedIn: Boolean(page.actor),
    spaces: spacesResult.ok
      ? spacesResult.spaces.map((space) => ({ id: space.id, name: space.name }))
      : [],
  });
}

export async function createCityPost(
  citySlug: string,
  input: { content: string; spaceId: string; title?: string },
): Promise<Result<{ id: string }>> {
  const page = await requireCityActor(citySlug);
  if (!page.ok) {
    return page;
  }
  const created = await createPost(page.store, page.actor, {
    content: input.content,
    spaceId: input.spaceId,
    title: input.title,
  });
  if (!created.ok) {
    return created;
  }
  return ok({ id: created.post.id });
}

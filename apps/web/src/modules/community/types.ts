export interface SpaceDetail {
  color: string | null;
  description: string | null;
  icon: string | null;
  id: string;
  isPrivate: boolean;
  name: string;
  order: number;
  postCount: number;
  slug: string;
}

export interface SpaceCreateBody {
  color?: string | null;
  description?: string | null;
  icon?: string | null;
  name: string;
  slug?: string;
}

export interface PostCreateBody {
  content: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  spaceId: string;
  title?: string | null;
}

export interface PostUpdateBody {
  content?: string | null;
  mediaType?: string | null;
  mediaUrl?: string | null;
  removeImage?: boolean;
  spaceId?: string | null;
  title?: string | null;
}

export interface PostDetail {
  authorId: string;
  commentCount: number;
  content: string;
  createdAt: string;
  id: string;
  isBookmarked: boolean;
  isPinned: boolean;
  mediaType: string | null;
  mediaUrl: string | null;
  reactionCount: number;
  space: { color: string | null; id: string; name: string; slug: string } | null;
  title: string | null;
  updatedAt: string;
}

export interface CommentNode {
  authorId: string;
  content: string;
  createdAt: string;
  id: string;
  parentId: string | null;
  replies: CommentNode[];
}

export interface CreateCommentBody {
  content: string;
  parentId?: string | null;
  postId: string;
}

export interface ReactionSummary {
  count: number;
  emoji: string;
  reacted: boolean;
}

export interface Clock {
  now: () => Date;
}

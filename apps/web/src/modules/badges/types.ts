export interface BadgeInput {
  description?: string | null;
  imageUrl?: string | null;
  name: string;
}

export interface BadgeWrite {
  description: string | null;
  imageUrl: string | null;
  name: string;
}

export interface BadgeSummary {
  createdAt: string;
  description: string | null;
  id: string;
  imageUrl: string | null;
  name: string;
  userCount: number;
}

export interface BadgeHolder {
  awardedAt: string;
  userId: string;
}

export interface BadgeDetail extends BadgeSummary {
  users: BadgeHolder[];
}

export interface AwardedBadge {
  awardedAt: string;
  badgeId: string;
  id: string;
  userId: string;
}

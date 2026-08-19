export interface TierInput {
  color?: string | null;
  description?: string | null;
  features?: string[];
  isActive?: boolean;
  name: string;
  order?: number;
  price?: number;
  slug?: string;
  yearlyPrice?: number | null;
}

export interface TierWrite {
  color: string | null;
  description: string | null;
  features: string[];
  isActive: boolean;
  name: string;
  order: number;
  price: number;
  slug: string;
  yearlyPrice: number | null;
}

export interface TierSummary {
  color: string | null;
  createdAt: string;
  description: string | null;
  features: string[];
  id: string;
  isActive: boolean;
  name: string;
  order: number;
  price: number;
  slug: string;
  updatedAt: string;
  yearlyPrice: number | null;
}

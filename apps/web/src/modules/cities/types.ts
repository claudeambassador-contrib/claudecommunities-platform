export interface CityInput {
  description: string;
  isCapital: boolean;
  keywords: string[];
  name: string;
  slug: string;
  state: string;
  stateFull: string;
  timezone: string;
}

export interface CityWrite {
  description: string;
  isCapital: boolean;
  keywords: string[];
  name: string;
  slug: string;
  state: string;
  stateFull: string;
  timezone: string;
}

export interface AdminCity {
  description: string;
  id: string;
  isCapital: boolean;
  keywords: string[];
  name: string;
  position: number;
  slug: string;
  state: string;
  stateFull: string;
  timezone: string;
}

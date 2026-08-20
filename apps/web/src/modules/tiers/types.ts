import type { z } from "zod";
import type { tierWriteInput } from "@/modules/tiers/schemas";

/**
 * The single tier write shape, owned by the module's zod schema. Both
 * create and update bodies use it as-is.
 *
 * Uses `z.input` (not `z.infer`/`z.output`): `order`, `price`, and
 * `yearlyPrice` go through `z.preprocess` to default missing/empty values,
 * so their *output* type is a required primitive even though callers may
 * omit them pre-validation. `z.input` reflects what a caller may actually
 * hand in before `tierWriteInput.safeParse` fills the defaults.
 */
export type TierInput = z.input<typeof tierWriteInput>;

/**
 * Persistence write DTO — the same write shape after
 * `tierWriteInput.safeParse` (so `order`/`price`/`yearlyPrice` are the
 * coerced-and-defaulted numbers, not the loose pre-validation `unknown`
 * from `TierInput`) plus the service-level normalizations on top: `slug`
 * generated (from `slug ?? name`) and guaranteed non-empty, `features`
 * filtered to drop falsy entries, `isActive` defaulted to `true`.
 */
export type TierWrite = Omit<z.output<typeof tierWriteInput>, "features" | "isActive" | "slug"> & {
  features: string[];
  isActive: boolean;
  slug: string;
};

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

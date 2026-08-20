import { z } from "zod";

/**
 * The single write schema for a membership tier — used by `tiersService` for
 * both create and update. Routes reuse this shape (in full, or a `.pick()`
 * subset) in their `cityInput(...)` calls rather than restating field rules.
 */
export const tierWriteInput = z.object({
  color: z.string().trim().optional(),
  description: z.string().trim().optional(),
  features: z.array(z.string().trim()).optional(),
  isActive: z.boolean().optional(),
  name: z.string().trim().min(1, "Tier name is required"),
  order: z.number().int().min(0, "order must be an integer ≥ 0").optional(),
  price: z.coerce.number().min(0, "price must be a number ≥ 0").default(0),
  slug: z.string().optional(),
  yearlyPrice: z.coerce
    .number()
    .min(0, "yearlyPrice must be a number ≥ 0")
    .nullable()
    .default(null),
});

export type TierWriteInputParsed = z.infer<typeof tierWriteInput>;

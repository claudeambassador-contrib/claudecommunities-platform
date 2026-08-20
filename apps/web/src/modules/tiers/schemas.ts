import { z } from "zod";

const emptyToDefault =
  <T>(fallback: T) =>
  (val: unknown): unknown =>
    val === undefined || val === null || val === "" ? fallback : val;

const nonNegativeFiniteNumber = (field: string) =>
  z.coerce
    .number()
    .refine((value) => Number.isFinite(value) && value >= 0, `${field} must be a number ≥ 0`);

const trimmedNullable = () =>
  z
    .string()
    .trim()
    .nullish()
    .transform((value) => value || null);

/**
 * The single write schema for a membership tier — used by `tiersService` for
 * both create and update. Routes reuse this shape (in full, or a `.pick()`
 * subset) in their `cityInput(...)` calls rather than restating field rules.
 *
 * `price`/`yearlyPrice` preprocess `undefined`/`null`/`""` to their old
 * defaults (0 / null) before coercion, matching the pre-zod
 * `parseNonNegative`/`parseOptionalNonNegative` helpers exactly — including
 * rejecting non-finite results (`Infinity`, `"1e999"`), which a bare
 * `z.coerce.number().min(0)` would silently accept.
 */
export const tierWriteInput = z.object({
  color: trimmedNullable(),
  description: trimmedNullable(),
  features: z.array(z.string().trim()).optional(),
  isActive: z.boolean().optional(),
  name: z.string().trim().min(1, "Tier name is required"),
  order: z.preprocess(emptyToDefault(0), z.number().int().min(0, "order must be an integer ≥ 0")),
  price: z.preprocess(emptyToDefault(0), nonNegativeFiniteNumber("price")),
  slug: z.string().optional(),
  yearlyPrice: z.preprocess(
    emptyToDefault(null),
    z.union([z.null(), nonNegativeFiniteNumber("yearlyPrice")]),
  ),
});

export type TierWriteInputParsed = z.infer<typeof tierWriteInput>;

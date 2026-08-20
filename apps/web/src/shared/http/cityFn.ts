import { z } from "zod";
import type { Permission } from "@/shared/auth/permissions";
import type { Result } from "@/shared/http/errors";
import {
  type Guarded,
  type GuardedPage,
  guarded,
  guardedMutation,
  type Mutated,
} from "@/shared/http/guarded";

/** Every city server fn takes the city slug plus whatever the route declares. */
export type CityData<S extends z.ZodRawShape = Record<never, never>> = z.infer<z.ZodObject<S>> & {
  citySlug: string;
};

/**
 * The merged validator schema for a city server fn: `citySlug` is always
 * required, the route's own shape is merged on top.
 *
 * ```ts
 * const input = cityInput({ name: z.string() });
 * createServerFn({ method: "POST" }).validator((raw: unknown) => input.parse(raw))
 * ```
 *
 * This file must stay importable from the client bundle for the *schema* half,
 * so `cityHandler` / `cityMutationHandler` may only ever be referenced inside a
 * `.handler(...)` argument (which the TanStack Start compiler strips).
 */
export function cityInput<S extends z.ZodRawShape = Record<never, never>>(
  shape?: S,
): z.ZodType<CityData<S>> {
  return z.object({ citySlug: z.string().min(1), ...(shape ?? {}) }) as unknown as z.ZodType<
    CityData<S>
  >;
}

/**
 * The GET handler body: runs `guarded` (city page load + signed-in actor +
 * optional permission) and returns the `Guarded<T>` shape the route's
 * `DeniedCard` branch already understands.
 *
 * Pass `permission` only when the service the handler calls is deliberately
 * public (e.g. `listPublicTiers`) and the route still needs a gate — otherwise
 * the permission check lives in the module service (`ensurePermission`).
 */
export function cityHandler<D extends { citySlug: string }, T extends object>(
  permission: Permission | null,
  fn: (page: GuardedPage, data: D) => Promise<Result<T>>,
): (ctx: { data: D }) => Promise<Guarded<T>> {
  return (ctx) => guarded(ctx.data.citySlug, permission, (page) => fn(page, ctx.data));
}

/** The mutation twin of `cityHandler`, returning the `Mutated<T>` shape. */
export function cityMutationHandler<D extends { citySlug: string }, T extends object>(
  permission: Permission | null,
  fn: (page: GuardedPage, data: D) => Promise<Result<T>>,
): (ctx: { data: D }) => Promise<Mutated<T>> {
  return (ctx) => guardedMutation(ctx.data.citySlug, permission, (page) => fn(page, ctx.data));
}

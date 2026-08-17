import { openTenantStore } from "@/shared/db/env";
import { err, ok, type Result } from "@/shared/http/errors";
import { resolveCityContext } from "@/modules/tenants/services/resolveCityService";
import * as eventsRepo from "@/modules/events/repositories/eventsRepository";
import { toSafeSlug } from "@/shared/ids";
import {
  buildCityRouteContext,
  requirePermission,
} from "@/modules/identity/services/sessionService";

export async function listEvents(
  citySlug: string,
): Promise<Result<{ events: Awaited<ReturnType<typeof eventsRepo.listPublished>> }>> {
  const city = await resolveCityContext(citySlug);
  if (!city.ok) return city;
  const store = openTenantStore(city.tenant);
  const events = await eventsRepo.listPublished(store);
  return ok({ events });
}

export async function createEvent(
  citySlug: string,
  input: { title: string; slug?: string; description?: string },
): Promise<Result<{ event: Awaited<ReturnType<typeof eventsRepo.insert>> }>> {
  const built = await buildCityRouteContext(citySlug);
  if (!built.ok) return built;
  const perm = requirePermission(built.ctx, "events.edit");
  if (!perm.ok) return perm;

  const store = openTenantStore(built.ctx.tenant);
  const slug = toSafeSlug(input.slug ?? input.title);
  const existing = await eventsRepo.findBySlug(store, slug);
  if (existing) return err("slug_taken", 409);

  const event = await eventsRepo.insert(store, {
    slug,
    title: input.title,
    description: input.description,
    status: "draft",
  });
  return ok({ event });
}

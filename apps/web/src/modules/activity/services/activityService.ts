// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as activityRepo from "@/modules/activity/repositories/activityRepository";
import type {
  ActivityItem,
  ListActivityOptions,
  RecordActivityInput,
} from "@/modules/activity/types";
import type { TenantStore } from "@/shared/db/tenantStore";
import { ok, type Result } from "@/shared/http/errors";

export async function recordActivity(
  store: TenantStore,
  input: RecordActivityInput,
): Promise<Result<{ recorded: boolean }>> {
  if (!(input.userId.trim() && input.type.trim())) {
    return ok({ recorded: false });
  }
  try {
    await activityRepo.insertActivity(store, {
      data: input.data,
      type: input.type.trim(),
      userId: input.userId.trim(),
    });
    return ok({ recorded: true });
  } catch {
    return ok({ recorded: false });
  }
}

export async function listActivity(
  store: TenantStore,
  options: ListActivityOptions = {},
): Promise<Result<{ activities: ActivityItem[] }>> {
  return ok({ activities: await activityRepo.listActivities(store, options) });
}

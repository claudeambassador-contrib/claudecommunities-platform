import type { PublishStarter } from "@/modules/social/types";

export function publishStarterFromEnv(env: Record<string, unknown>): PublishStarter | undefined {
  const binding = env.PUBLISH_POST as
    | { create: (opts: { params: unknown }) => Promise<unknown> }
    | undefined;
  if (!binding?.create) {
    return undefined;
  }
  return {
    async start(params) {
      await binding.create({ params });
    },
  };
}

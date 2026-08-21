/** Clerk is configured only when both keys are present. Missing keys used to
 *  fall into Clerk "keyless" handshake mode, which 500s public pages. */
export function clerkPublishableKey(): string {
  if (typeof process !== "undefined" && "VITE_CLERK_PUBLISHABLE_KEY" in process.env) {
    return (process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "").trim();
  }
  const fromImport =
    import.meta === undefined
      ? undefined
      : (import.meta as ImportMeta & { env?: { VITE_CLERK_PUBLISHABLE_KEY?: string } }).env
          ?.VITE_CLERK_PUBLISHABLE_KEY;
  return (fromImport ?? "").trim();
}

export function clerkSecretKey(): string {
  return (typeof process === "undefined" ? undefined : process.env.CLERK_SECRET_KEY)?.trim() ?? "";
}

/** Resolve keys from process/Vite first, then a Worker `env` record. */
export function clerkKeysFromRecord(record?: Record<string, unknown>): {
  publishable: string;
  secret: string;
} {
  const fromRecord = (name: string) => String(record?.[name] ?? "").trim();
  return {
    publishable:
      clerkPublishableKey() ||
      fromRecord("VITE_CLERK_PUBLISHABLE_KEY") ||
      fromRecord("CLERK_PUBLISHABLE_KEY"),
    secret: clerkSecretKey() || fromRecord("CLERK_SECRET_KEY"),
  };
}

export function isClerkPublishableConfigured(): boolean {
  return clerkPublishableKey().length > 0;
}

export function isClerkServerConfigured(record?: Record<string, unknown>): boolean {
  const keys = clerkKeysFromRecord(record);
  return keys.publishable.length > 0 && keys.secret.length > 0;
}

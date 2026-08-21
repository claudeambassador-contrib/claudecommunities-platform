import { afterEach, describe, expect, it } from "vitest";

import {
  clerkKeysFromRecord,
  clerkPublishableKey,
  clerkSecretKey,
  isClerkPublishableConfigured,
  isClerkServerConfigured,
} from "@/shared/auth/clerk";

const KEYS = ["VITE_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"] as const;

describe("clerk config helpers", () => {
  const previous = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of KEYS) {
      if (previous[key] === undefined) {
        // oxlint-disable-next-line typescript/no-dynamic-delete -- restore env keys after each test
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  });

  it("treats missing keys as unconfigured so middleware can stay off", () => {
    process.env.VITE_CLERK_PUBLISHABLE_KEY = "";
    process.env.CLERK_SECRET_KEY = "";
    expect(clerkPublishableKey()).toBe("");
    expect(clerkSecretKey()).toBe("");
    expect(isClerkPublishableConfigured()).toBeFalsy();
    expect(isClerkServerConfigured()).toBeFalsy();
  });

  it("requires both keys on the server", () => {
    process.env.VITE_CLERK_PUBLISHABLE_KEY = "pk_test_x";
    process.env.CLERK_SECRET_KEY = "sk_test_x";
    expect(isClerkPublishableConfigured()).toBeTruthy();
    expect(isClerkServerConfigured()).toBeTruthy();
  });

  it("falls back to a Worker env record when process env is empty", () => {
    process.env.VITE_CLERK_PUBLISHABLE_KEY = "";
    process.env.CLERK_SECRET_KEY = "";
    const keys = clerkKeysFromRecord({
      CLERK_SECRET_KEY: "sk_test_worker",
      VITE_CLERK_PUBLISHABLE_KEY: "pk_test_worker",
    });
    expect(keys.publishable).toBe("pk_test_worker");
    expect(keys.secret).toBe("sk_test_worker");
    expect(
      isClerkServerConfigured({
        CLERK_SECRET_KEY: "sk_test_worker",
        VITE_CLERK_PUBLISHABLE_KEY: "pk_test_worker",
      }),
    ).toBeTruthy();
  });
});

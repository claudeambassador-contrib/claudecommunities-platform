import { clerk, clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import type { BrowserContext, Page } from "@playwright/test";

const CONTINUE_NAME = /continue/i;
const EMAIL_NAME = /email address|email/i;

let clerkTestingReady = false;

export async function prepareClerkTesting(context: BrowserContext): Promise<void> {
  if (!clerkTestingReady) {
    await clerkSetup();
    clerkTestingReady = true;
  }
  await setupClerkTestingToken({ context });
}

export async function clerkSignIn(page: Page, email: string, password: string): Promise<void> {
  if (!(email && password)) {
    throw new Error(
      "Missing E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD. Run bun scripts/seed-e2e-admin.ts",
    );
  }

  if (!page.url().includes("/login")) {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
  }
  await clerk.loaded({ page });

  const identifier = page
    .locator('input[name="identifier"]')
    .or(page.getByRole("textbox", { name: EMAIL_NAME }));
  if (
    await identifier
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    await identifier.first().fill(email);
    const next = page.getByRole("button", { name: CONTINUE_NAME }).first();
    if (await next.isVisible().catch(() => false)) {
      await next.click();
    }
    const passwordBox = page.locator('input[type="password"]');
    if (
      await passwordBox
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await passwordBox.first().fill(password);
    }
  }

  await clerk.signIn({ emailAddress: email, page });
  await page.waitForFunction(() => Boolean(window.Clerk?.user), undefined, { timeout: 20_000 });
}

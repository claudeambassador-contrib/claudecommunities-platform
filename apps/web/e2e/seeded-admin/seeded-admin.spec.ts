import { expect, test } from "@playwright/test";

import { clerkSignIn, prepareClerkTesting } from "../utils/clerk-sign-in";
import {
  captureStep,
  createPresentationContext,
  finalizePresentation,
  SEEDED_USERS,
} from "../utils/presentation";

const SLUG = "seeded-admin";
const PERSONA = SEEDED_USERS.admin;
const CITY = PERSONA.tenant ?? "sydney";
const STORIES = [
  "Sign in at /login with the seeded Clerk admin",
  "Owner invite is claimed — /sydney/admin shows the owner dashboard",
  "Admin events lists the seeded Claude Code Meetup",
  "Signed-in city home still renders the seeded CMS heading",
];
const ADMIN_DENIED = /admin access required/i;
const CLERK_MISSING = /clerk keys are not configured/i;
const OWNER_ROLE = /role:\s*owner/i;
const SEEDED_MEETUP = /claude code meetup/i;
const SEEDED_HOME = /welcome to the seeded city/i;

test.describe.configure({ mode: "serial" });

test.describe(`${SLUG} presentation`, () => {
  test("seeded admin claims owner and reaches admin", async ({ browser }) => {
    test.skip(!(PERSONA.email && PERSONA.password), "Run bun scripts/seed-e2e-admin.ts first");

    const artifacts = await createPresentationContext(browser, SLUG);
    await prepareClerkTesting(artifacts.context);
    const page = await artifacts.context.newPage();
    let passed = false;
    let testError: string | undefined;

    try {
      await page.goto("/login", { waitUntil: "domcontentloaded" });
      await expect(page.getByText(CLERK_MISSING)).toHaveCount(0);
      await captureStep(page, artifacts, "01-login", "Login page with Clerk");

      await clerkSignIn(page, PERSONA.email, PERSONA.password);
      await captureStep(page, artifacts, "02-signed-in", "Signed in after Clerk");

      await page.goto(`/${CITY}/admin`, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(new RegExp(`/${CITY}/admin/?$`));
      await expect(page.getByText(ADMIN_DENIED)).toHaveCount(0);
      await expect(page.getByText(OWNER_ROLE)).toBeVisible();
      await captureStep(page, artifacts, "03-admin-dashboard", "Sydney admin as owner");

      await page.goto(`/${CITY}/admin/events`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(ADMIN_DENIED)).toHaveCount(0);
      await expect(page.getByText(SEEDED_MEETUP)).toBeVisible();
      await captureStep(page, artifacts, "04-admin-events", "Admin events includes seeded meetup");

      await page.goto(`/${CITY}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(SEEDED_HOME)).toBeVisible();
      await captureStep(page, artifacts, "05-city-home", "Signed-in city home");

      passed = true;
    } catch (error) {
      testError = error instanceof Error ? error.message : String(error);
      try {
        await captureStep(page, artifacts, "99-failure", "Failure state");
      } catch {
        /* ignore */
      }
      throw error;
    } finally {
      await page.close();
      const result = await finalizePresentation(artifacts, {
        error: testError,
        passed: passed && !testError,
        persona: PERSONA,
        stories: STORIES,
        title: SLUG,
      });
      console.log(`Open presentation: file://${result.htmlPath}`);
    }
  });
});

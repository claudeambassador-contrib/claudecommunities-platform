import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  captureStep,
  createPresentationContext,
  finalizePresentation,
  SEEDED_USERS,
} from "../utils/presentation";

const SLUG = "tanstack-walkthrough";
const PERSONA = SEEDED_USERS.owner;
const CITY = PERSONA.tenant ?? "sydney";
const STORIES = [
  "Seed Sydney → public home shows seeded city content",
  "Open /login → sign in with Clerk → land as owner",
  "Public city: events (Claude Code Meetup), cities, courses, speak",
  "Community: feed, seeded posts, members, profile, search",
  "Admin: dashboard, events, posts, users, pages, email, social, tools",
  "Record unfinished / stub / broken pages as the finish-off issue list",
];

type Finding = {
  severity: "blocker" | "high" | "medium" | "low";
  title: string;
  detail: string;
  url: string;
};

const STUB_RE =
  /coming soon|not ported|not available|not been ported|will return here|Next\.js|empty card|no published|no posts yet|no events yet|page not found|admin access required|unauthenticated|forbidden|something went wrong|internal server|undefined is not|cannot read/i;

test.describe.configure({ mode: "serial" });

test.describe(`${SLUG} presentation`, () => {
  test("run presentation workflow", async ({ browser }) => {
    test.setTimeout(300_000);
    const artifacts = await createPresentationContext(browser, SLUG);
    const page = await artifacts.context.newPage();
    const findings: Finding[] = [];
    const consoleErrors: string[] = [];
    let passed = false;
    let testError: string | undefined;
    let signedIn = false;
    let step = 1;

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(err.message);
    });

    const snap = async (id: string, label: string) => {
      const n = String(step).padStart(2, "0");
      step += 1;
      await captureStep(page, artifacts, `${n}-${id}`, label);
      await notePage(page, findings, label);
    };

    const visit = async (path: string, id: string, label: string) => {
      await artifacts.context.clearCookies();
      const response = await page.goto(path, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(400);
      const status = response?.status() ?? 0;
      const body = ((await page.locator("body").innerText().catch(() => "")) ?? "").slice(0, 2000);
      if (status >= 500 || /HTTPError|"status":500/i.test(body)) {
        findings.push({
          severity: "blocker",
          title: `${label} returned ${status || 500}`,
          detail: body.replace(/\s+/g, " ").slice(0, 280) || "Empty 5xx body",
          url: page.url(),
        });
      }
      await snap(id, label);
      return body;
    };

    try {
      const home = await visit("/", "platform-home", "Platform directory");
      if (!/sydney/i.test(home)) {
        findings.push({
          severity: "blocker",
          title: "Sydney not listed on platform home",
          detail: home.replace(/\s+/g, " ").slice(0, 280) || "Directory empty or page crashed.",
          url: page.url(),
        });
      }

      const cityHome = await visit(`/${CITY}`, "city-home", "Sydney city home");
      if (!/welcome to the seeded city/i.test(cityHome)) {
        findings.push({
          severity: "high",
          title: "City home does not render seeded CMS heading",
          detail:
            "Seed writes pages.home heading 'Welcome to the seeded city', but /$citySlug shows a hardcoded Welcome card instead of CMS home.",
          url: page.url(),
        });
      }

      await visit(`/${CITY}/p/home`, "cms-home", "CMS home page /p/home");
      const events = await visit(`/${CITY}/events`, "events", "Events list");
      if (!/claude code meetup/i.test(events)) {
        findings.push({
          severity: "high",
          title: "Seeded meetup missing from events list",
          detail: events.replace(/\s+/g, " ").slice(0, 280),
          url: page.url(),
        });
      }
      await visit(`/${CITY}/events/claude-code-meetup`, "event-detail", "Published meetup detail");

      await visit(`/${CITY}/cities/sydney`, "cities", "Cities page");
      await visit(`/${CITY}/courses`, "courses", "Courses");
      await visit(`/${CITY}/speak`, "speak", "Speak");
      await visit(`/${CITY}/merch`, "merch", "Merch");
      await visit(`/${CITY}/resources`, "resources", "Resources");
      await visit(`/${CITY}/cowork`, "cowork", "Cowork");
      await visit(`/${CITY}/professionals`, "professionals", "Professionals");
      await visit(`/${CITY}/vibe-coders`, "vibe-coders", "Vibe coders");
      await visit(`/${CITY}/impact-lab`, "impact-lab", "Impact Lab");
      await visit("/pricing", "pricing", "Pricing");
      await visit("/remotion", "remotion", "Remotion");

      const feed = await visit(`/${CITY}/community`, "community-feed", "Community feed");
      if (!/welcome to the community/i.test(feed)) {
        findings.push({
          severity: "high",
          title: "Seeded announcement post missing from feed",
          detail: "Expected 'Welcome to the community' from city seed.",
          url: page.url(),
        });
      }

      await visit(`/${CITY}/community/members`, "members", "Members");
      await visit(`/${CITY}/community/search?q=welcome`, "search", "Community search");
      await visit(`/${CITY}/community/learn`, "learn", "Learn");
      await visit(`/${CITY}/community/leaderboard`, "leaderboard", "Leaderboard");
      await visit(`/${CITY}/community/guidelines`, "guidelines", "Guidelines");

      await visit("/login", "login", "Login page");
      signedIn = await tryClerkSignIn(page, PERSONA.email, PERSONA.password);
      await snap("login-result", signedIn ? "Signed in" : "Login did not complete");
      if (!signedIn) {
        findings.push({
          severity: "blocker",
          title: "Clerk sign-in did not complete",
          detail:
            "Local apps/web is in Clerk keyless mode (no .env.local keys). Handshake cookies then 500 the next request. Set VITE_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY and allow http://localhost:3001.",
          url: page.url(),
        });
      }

      const memberOnly = [
        ["community/profile", "Own profile"],
        ["community/bookmarks", "Bookmarks"],
        ["community/notifications", "Notifications"],
        ["community/connections", "Connections"],
        ["community/settings/profile", "Profile settings"],
        ["community/settings/notifications", "Notification settings"],
      ] as const;
      for (const [path, label] of memberOnly) {
        await visit(`/${CITY}/${path}`, path.replaceAll("/", "-"), label);
      }

      const adminPages = [
        ["admin", "Admin dashboard"],
        ["admin/events", "Admin events"],
        ["admin/posts", "Admin posts"],
        ["admin/users", "Admin users"],
        ["admin/pages", "Admin pages"],
        ["admin/pages/home", "Home CMS"],
        ["admin/email", "Email campaigns"],
        ["admin/email/contacts", "Email contacts"],
        ["admin/email/templates", "Email templates"],
        ["admin/email/automations", "Email automations"],
        ["admin/email/settings", "Email settings"],
        ["admin/email/analytics", "Email analytics"],
        ["admin/social", "Social"],
        ["admin/social/settings", "Social settings"],
        ["admin/tools", "Tools"],
        ["admin/tools/slide-generator", "Slide generator"],
        ["admin/tools/qr-generator", "QR generator"],
        ["admin/tools/attendance-planner", "Attendance planner"],
        ["admin/tools/attendee-analytics", "Attendee analytics"],
        ["admin/invite", "Invite"],
        ["admin/import", "Import"],
        ["admin/roles", "Roles"],
        ["admin/badges", "Badges"],
        ["admin/tiers", "Tiers"],
        ["admin/cities", "Admin cities"],
        ["admin/industries", "Industries"],
        ["admin/courses", "Admin courses"],
        ["admin/speakers", "Speakers"],
        ["admin/settings", "Settings"],
        ["admin/analytics", "Analytics"],
      ] as const;
      for (const [path, label] of adminPages) {
        await visit(`/${CITY}/${path}`, path.replaceAll("/", "-"), label);
      }

      if (consoleErrors.length > 0) {
        findings.push({
          severity: "medium",
          title: "Browser console errors during walkthrough",
          detail: unique(consoleErrors).slice(0, 12).join(" | "),
          url: page.url(),
        });
      }

      passed = findings.filter((f) => f.severity === "blocker").length === 0;
    } catch (error) {
      testError = error instanceof Error ? error.message : String(error);
      try {
        await snap("failure", "Failure state");
      } catch {
        /* ignore screenshot failure */
      }
      throw error;
    } finally {
      await writeFile(
        join(artifacts.rootDir, "issues.json"),
        JSON.stringify({ signedIn, findings }, null, 2),
        "utf8",
      );
      await page.close();
      const result = await finalizePresentation(artifacts, {
        title: SLUG,
        persona: PERSONA,
        stories: STORIES,
        passed: passed && !testError,
        error: testError,
      });
      console.log(`Open presentation: file://${result.htmlPath}`);
      console.log(`Issues: ${findings.length} signedIn=${signedIn}`);
    }
  });
});

async function tryClerkSignIn(page: Page, email: string, password: string): Promise<boolean> {
  if (!(email && password)) {
    return false;
  }
  try {
    const emailBox = page
      .getByRole("textbox", { name: /email|identifier/i })
      .or(page.locator('input[name="identifier"], input[type="email"]'))
      .first();
    await emailBox.waitFor({ state: "visible", timeout: 12_000 });
    await emailBox.fill(email);
    const continueBtn = page.getByRole("button", { name: /continue|sign in/i }).first();
    if (await continueBtn.isVisible()) {
      await continueBtn.click();
    }
    const passwordBox = page
      .locator('input[type="password"], input[name="password"]')
      .first();
    await passwordBox.waitFor({ state: "visible", timeout: 12_000 });
    await passwordBox.fill(password);
    await page.getByRole("button", { name: /continue|sign in/i }).first().click();
    await page.waitForTimeout(2500);
    return /\/(sydney|login\/sso-callback)?/.test(page.url()) && !page.url().includes("/login");
  } catch {
    return false;
  }
}

async function notePage(page: Page, findings: Finding[], label: string): Promise<void> {
  const url = page.url();
  const body = ((await page.locator("body").innerText().catch(() => "")) ?? "").slice(0, 4000);
  const match = body.match(STUB_RE);
  if (match) {
    findings.push({
      severity: /admin access|unauthenticated|forbidden|internal server|undefined is not|cannot read|page not found/i.test(
        match[0],
      )
        ? "high"
        : "medium",
      title: `${label}: ${match[0]}`,
      detail: body.replace(/\s+/g, " ").slice(0, 280),
      url,
    });
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

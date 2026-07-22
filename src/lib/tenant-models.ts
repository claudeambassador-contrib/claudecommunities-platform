/**
 * Model → tenancy-scope map. The single reviewed artifact that BOTH the
 * `$extends` chokepoint (`src/lib/tenant-scope.ts`) and the schema migrations
 * consume. See `docs/multi-tenancy-isolation-spec.md` §4.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * FAIL CLOSED. Every Prisma model MUST appear in exactly one of the two sets
 * below. A model in NEITHER set is a build failure (CI test) AND throws at
 * runtime inside the chokepoint — it never silently passes through unscoped.
 * The headline isolation failure (§4) is a tenant-scoped model silently
 * treated as global, so the unsafe case can never be the default.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * TENANT_SCOPED  — rows belong to exactly one community. Carry a `tenantId`
 *                  column; the scoped client (`getPrisma()`) injects/filters
 *                  `tenantId` on every operation.
 * GLOBAL         — rows key on a person's platform identity, a platform-wide
 *                  artifact, or the tenant registry itself. No `tenantId`;
 *                  reached only via `getPlatformPrisma()` (or, for `User`, the
 *                  unscoped identity lookups in `auth.ts`).
 */

/** A tenant-scoped model name (carries `tenantId`; the chokepoint scopes it). */
export const TENANT_SCOPED_MODELS = new Set<string>([
  // ── Identity-adjacent, per-community ──────────────────────────────────
  "Role", // PK reshaped to @@id([tenantId, name]) — a "member" role per community
  "UserTenant", // membership join; tenantId IS the membership's tenant → auto-injects on the membership check
  "PendingAdminGrant", // invitees to a specific community (pre-account)
  "AuditLog", // tenantId-stamped actions
  // ── Gamification / badges ─────────────────────────────────────────────
  "Badge",
  "UserBadge",
  "LeaderboardLevel",
  // ── Home Page CMS ─────────────────────────────────────────────────────
  "Page", // tenant-editable home page (one row per tenant, key="home")
  // ── City catalog (per-community) ──────────────────────────────────────
  "City",
  // ── Industry / vertical landing pages (per-community, served at /for) ──
  "IndustryPage",
  // ── Spaces & feed ─────────────────────────────────────────────────────
  "SpaceGroup",
  "Space",
  "SpaceView",
  "Post",
  "Comment",
  "Reaction",
  "CommentReaction",
  "Like",
  "Bookmark",
  "Poll",
  "PollOption",
  "PollVote",
  "Attachment",
  "Mention",
  // ── Events ────────────────────────────────────────────────────────────
  "Event",
  "EventAgendaItem",
  "Speaker",
  "EventResource",
  "EventRSVP",
  "EventLumaInterest",
  "TalkSubmission",
  "TalkComment",
  // ── Marketing content ─────────────────────────────────────────────────
  "Resource", // per-tenant /resources videos (one row per resource)
  // ── Courses ───────────────────────────────────────────────────────────
  "Course",
  "Lesson",
  "CourseEnrollment",
  "LessonProgress",
  "ScheduledCourse",
  // ── Membership / billing ──────────────────────────────────────────────
  "MembershipTier",
  "Subscription",
  // ── Per-community user activity & analytics ───────────────────────────
  "Activity",
  "Notification",
  "EmailPreference", // per-community notification prefs (§3 #25)
  "Connection",
  "PageView",
  "AnalyticsEvent",
  "DigestLog",
  "UserTag",
  "UserTagAssignment",
  // ── Email platform (per community) ────────────────────────────────────
  "EmailCampaign",
  "EmailSend",
  "EmailSegment",
  "EmailTemplate",
  "EmailSavedBlock",
  "ContactList",
  "ContactListMember",
  "EmailTrackingEvent",
  "EmailTrackedLink",
  "EmailABTest",
  "EmailABVariant",
  "EmailAutomation",
  "AutomationStep",
  "AutomationEnrollment",
  // ── Slide generator ───────────────────────────────────────────────────
  "SlideGeneratorState", // PK reshaped to @@id([tenantId, scope])
  "SlideStylePreset",
  "SlideRender",
  "SlideExportJob",
  // ── Social posting (§4 adversarial finding — were unscoped) ───────────
  "SocialAccount",
  "SocialPost",
]);

/** A platform-global model (no `tenantId`; reached via `getPlatformPrisma()`). */
export const GLOBAL_MODELS = new Set<string>([
  // ── Platform identity ─────────────────────────────────────────────────
  "User", // a person can belong to many communities; identity is platform-wide
  "EmailSuppressionList", // an unsubscribe is platform-wide (§3 #17)
  // ── Tenant registry / config (read pre-tenant during resolution) ──────
  "Tenant",
  "TenantSetting",
  // ── Impact Lab hackathon portal ───────────────────────────────────────
  // DECISION (2026-06-15): the Impact Lab is a single, self-contained event
  // portal with its OWN session auth (not Clerk) and is region-gated, not part
  // of the per-community SaaS surface. It stays platform-global rather than
  // forcing a tenantId onto 11 one-off-event tables. Revisit only if/when we
  // want each tenant to run its own hackathon portal.
  "ImpactLabConfig",
  "ImpactLabTeam",
  "ImpactLabParticipant",
  "ImpactLabTeamVote",
  "ImpactLabCoffeeCode",
  "ImpactLabProblemStatement",
  "ImpactLabVote",
  "ImpactLabScheduleItem",
  "ImpactLabResource",
  "ImpactLabInterest",
  "ImpactLabSponsor",
]);

/**
 * Classify a model name. Returns "tenant" | "global" | "unknown".
 * "unknown" is the fail-closed signal — the chokepoint throws on it and the CI
 * model-map-completeness test fails on it.
 */
export function classifyModel(model: string): "tenant" | "global" | "unknown" {
  if (TENANT_SCOPED_MODELS.has(model)) return "tenant";
  if (GLOBAL_MODELS.has(model)) return "global";
  return "unknown";
}

/** True iff the scoped client must inject/filter `tenantId` for this model. */
export function isTenantScoped(model: string): boolean {
  return TENANT_SCOPED_MODELS.has(model);
}

/** All classified model names (for the CI completeness assertion vs. the DMMF). */
export const ALL_CLASSIFIED_MODELS: ReadonlySet<string> = new Set<string>([
  ...TENANT_SCOPED_MODELS,
  ...GLOBAL_MODELS,
]);

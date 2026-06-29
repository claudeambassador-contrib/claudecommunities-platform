# Security Audit — Findings & Remediation Plan

**Audit date:** 2026-02-27

Full security review of the codebase. Three parallel audits covered: API route security, auth/middleware/email, and client-side/XSS. Findings below are verified and prioritized. False positives have been filtered out.

## Status (last reviewed 2026-05-26, post Neon→D1 migration)

Several items were remediated in earlier commits; the rest are still open.
The audit body below is preserved as the original finding — file paths may
have shifted (e.g. upload handling has moved into `src/lib/storage.ts` and
`src/lib/services/uploads.ts`), but the underlying issues are the same.

Verified **fixed** in current code:

- ✅ #1 Events API auth — POST/PUT/DELETE go through the service layer with
  admin checks; upload routes additionally enforce a 20/min rate limit via
  `assertUploadAllowed`.
- ✅ #5 SVG uploads — `src/lib/storage.ts` rejects `image/svg+xml`.
- ✅ #8 Rate limiting — applied to uploads; speakers / link-preview /
  events / users-search were addressed by `e8357b1` ("Finish security
  audit: zod input, rate limit, CSP report-only").

Verified **still open** in current code:

- ❌ #2 Banned users — `src/lib/auth.ts` `getCurrentUser()` returns the user
  without checking `isBanned`. Every caller needs to handle this itself.
- ❌ #3 HTML injection in email templates — no `escapeHtml` helper in
  `src/lib/resend.ts`.
- ❌ #7 Security headers — `next.config.ts` has no `headers()` function and
  no CSP middleware. The commit `e8357b1` references "CSP report-only" but
  that wiring is not visible in the current tree — re-verify.

Not re-verified for this status update: #4 (LessonContent escaping), #6
(upload `resourceType`), #9 (link-preview SSRF), #10 (RSVP race).

---

## CRITICAL — Fix Immediately

### 1. Events API has ZERO authentication
**Files:** `src/app/api/events/route.ts` (POST), `src/app/api/events/[id]/route.ts` (PUT, DELETE)

POST, PUT, and DELETE have no auth checks. Anyone on the internet can create, modify, or delete any event. GET is fine to leave public.

**Fix:** Add `getCurrentUser()` + admin role check to POST/PUT/DELETE handlers, matching the pattern in `src/app/api/admin/invite/route.ts`.

### 2. Banned users can still use the app
**File:** `src/lib/auth.ts` — `getCurrentUser()` and `ensureUserInDb()`

These functions return banned users without checking `isBanned`. A banned user with a valid Clerk session can still post, comment, like, RSVP, etc. across every authenticated endpoint.

**Fix:** After fetching the user, add `if (user?.isBanned) return null`. This single change propagates to all endpoints that use `getCurrentUser()`.

### 3. HTML injection in email templates
**File:** `src/lib/resend.ts` — `getNotificationEmailHtml()`, `getInviteEmailHtml()`, `getCampaignEmailHtml()`

User-provided values (`userName`, `title`, `message`, `personalMessage`) are interpolated directly into HTML templates without escaping. The speaker submission notification sends user-provided name/topic/bio into admin emails — an attacker could craft a submission with `<script>` or `<img onerror=...>` tags.

**Fix:** Add an `escapeHtml()` helper to `resend.ts` and apply it to all interpolated user values in every template function.

### 4. XSS via `dangerouslySetInnerHTML` in LessonContent
**File:** `src/components/LessonContent.tsx:65`

Custom markdown parser uses regex replacements then renders with `dangerouslySetInnerHTML`. Only code blocks are escaped — headers, links, bold, italic, blockquotes all pass user content through raw. Content like `## <img src=x onerror=alert(1)>` executes JS.

**Risk context:** Lesson content is admin-created, so exploitation requires a compromised admin account. Still should be fixed.

**Fix:** Apply the existing `escapeHtml()` function to the captured groups in each regex replacement before wrapping in HTML tags.

---

## HIGH — Fix Soon

### 5. SVG uploads allowed (XSS vector)
**File:** `src/app/api/upload/route.ts:12`

`image/svg+xml` is in `ALLOWED_IMAGE_TYPES`. SVGs can contain `<script>` tags and JS event handlers. If rendered in an `<img>` tag this is safe, but if served directly or used in `dangerouslySetInnerHTML` it's an XSS vector.

**Fix:** Remove `'image/svg+xml'` from `ALLOWED_IMAGE_TYPES`.

### 6. Upload PUT endpoint accepts user-controlled resourceType
**File:** `src/app/api/upload/route.ts:129`

`resourceType` comes from request body and is passed directly to the storage adapter. Setting `resourceType: 'raw'` bypasses type restrictions.

**Fix:** Remove `resourceType` from destructured body; hardcode to `'image'` or determine from the data URI prefix.

### 7. No security headers
**File:** `next.config.ts`

No Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, or Referrer-Policy headers configured.

**Fix:** Add `headers()` function to `next.config.ts` with standard security headers.

---

## MEDIUM — Address When Convenient

### 8. No rate limiting on public endpoints
`/api/speakers` (POST), `/api/link-preview`, `/api/users/search`, `/api/events` — all lack rate limiting. Vulnerable to spam and resource exhaustion.

### 9. Link preview SSRF potential
**File:** `src/app/api/link-preview/route.ts` — fetches arbitrary user-provided URLs. Could target internal services. Should block private IP ranges.

### 10. Event RSVP race condition
**File:** `src/app/api/events/[id]/rsvp/route.ts` — `maxAttendees` capacity check is not atomic. Concurrent requests can exceed the limit.

---

## Verified Non-Issues (No Action Needed)
- `.env` IS in `.gitignore` (`.env*` pattern) — secrets are not committed
- Cron secret check in `/api/digest` correctly falls through to admin auth when env var is unset
- All Prisma queries are parameterized — no SQL injection risk
- Clerk handles sessions securely with httpOnly cookies
- IDOR checks on posts/comments/connections are properly implemented
- Imported/invited users default to `member` role — no privilege escalation

---

## Remediation Steps (in priority order)

1. **`src/app/api/events/route.ts`** + **`src/app/api/events/[id]/route.ts`** — Add admin auth to POST/PUT/DELETE
2. **`src/lib/auth.ts`** — Add `isBanned` check to `getCurrentUser()` and `ensureUserInDb()`
3. **`src/lib/resend.ts`** — Add `escapeHtml()` utility, apply to all template interpolations
4. **`src/components/LessonContent.tsx`** — Escape captured groups in regex replacements
5. **`src/app/api/upload/route.ts`** — Remove SVG from allowed types, hardcode resourceType in PUT
6. **`next.config.ts`** — Add security headers

## Verification
1. Try `curl -X POST /api/events` without auth — should get 401
2. Ban a test user — verify they can't access authenticated endpoints
3. Submit speaker form with `<script>alert(1)</script>` in name — verify email shows escaped text
4. Attempt SVG upload — should be rejected
5. TypeScript builds clean
